export type Question =
  | {
      type: 'noul'
      instructions: string
      criteria?: { true?: string; false?: string }
    }
  | {
      type: 'choice'
      instructions: string
      criteria: Record<string, string | null>
    }
  | { type: 'score'; instructions: string; criteria: string[] }

export type Answer =
  | { type: 'noul'; noul: number }
  | {
      type: 'choice'
      choice: string
      probabilities: Record<string, number>
      confidence: number
    }
  | {
      type: 'score'
      score: number
      probabilities: Record<string, number>
      confidence: number
    }

export type Questions = Record<string, Question>
export type Answers = Record<string, Answer>

export interface Decision {
  type?: Answer['type']
  modelPicked?: string
  score?: number
  id: string
  seat: Seat
  label: string
  picked: string
  options: { key: string; p: number }[]
  confidence?: number
}

export type Seat = 'piano' | 'bass' | 'drums' | 'horn'

export const USD_PER_TOKEN = 0.042 / 1_000_000

export interface Stats {
  model: string
  ms: number
  questions: number
  inputTokens: number
  usd: number
}

export interface Note {
  at: number
  beats: number
  midi: number
  velocity: number
  seat: Seat
  kind?: 'kick' | 'snare' | 'hat' | 'ride' | 'brush' | 'rim' | 'tom' | 'tone'
}

export interface PianoPart {
  seat: 'piano'
  rest: boolean
  root: number
  quality: string
  voicing: string
  density: number
  time: string
  heard: string
}

export interface BassPart {
  seat: 'bass'
  rest: boolean
  feel: string
  energy: number
  motion: string
  target: string
  wander: boolean
  root: number
  heard: string
}

export interface DrumsPart {
  seat: 'drums'
  bpm: number
  rest: boolean
  kit: string
  density: number
  kick: string
  snare: string
  fill: boolean
  heard: string
}

export interface HornPart {
  seat: 'horn'
  rest: boolean
  color: string
  shape: string
  register: number
  landing: number
  heard: string
}

export type Part = PianoPart | BassPart | DrumsPart | HornPart

export interface Bar {
  bpm: number
  index: number
  at: number
  beats: number
  parts: { piano: PianoPart; bass: BassPart; drums: DrumsPart; horn: HornPart }
  notes: Note[]
  decisions: Decision[]
  stats: Stats
}

export interface Heard {
  barsSoFar: number
  last: string
  recent: string
  bpm: number
}

export interface Snapshot {
  bpm: number
  playing: boolean
  visitors: number
  minutesPlayed: number
  countingSince?: string
  barsPlayed: number
  elapsedMs: number
  bars: Bar[]
  mock: boolean
}
