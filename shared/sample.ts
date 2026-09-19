import type { Answer, Answers, Decision, Seat } from './types.ts'

export const rank = (probabilities: Record<string, number>, n = 40) =>
  Object.entries(probabilities)
    .map(([key, p]) => ({ key, p }))
    .sort((a, b) => b.p - a.p)
    .slice(0, n)

export function noise(seed: number, id: string): number {
  let h = 2166136261 ^ Math.imul(seed | 0, 2654435761)
  for (let i = 0; i < id.length; i++)
    h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  h += 0x6d2b79f5
  let t = Math.imul(h ^ (h >>> 15), 1 | h)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function pick(
  probabilities: Record<string, number>,
  seed: number,
  id: string,
  floor: number,
  temperature = 1,
): string {
  const viable = Object.entries(probabilities)
    .filter(([, p]) => Number.isFinite(p) && p > 0 && p >= floor)
    .map(
      ([k, p]) =>
        [k, temperature === 1 ? p : Math.pow(p, 1 / temperature)] as const,
    )
    .sort((a, b) => b[1] - a[1])
  if (viable.length <= 1) return viable[0]?.[0] ?? Object.keys(probabilities)[0]
  const total = viable.reduce((n, [, p]) => n + p, 0)
  let r = noise(seed, id) * total
  for (const [key, p] of viable) {
    r -= p
    if (r <= 0) return key
  }
  return viable[0][0]
}

export function sampledChoice(
  answers: Answers,
  id: string,
  fallback: string,
  seed: number,
  floor: number,
  temperature = 1,
): { key: string; decision?: Decision } {
  const a = answers[id]
  if (a?.type !== 'choice') return { key: fallback }
  const key = seed
    ? pick(a.probabilities, seed, id, floor, temperature) || a.choice
    : a.choice
  return {
    key,
    decision: {
      id,
      seat: 'piano',
      label: '',
      picked: key,
      options: rank(a.probabilities),
      confidence: a.confidence,
    },
  }
}

export function sampledLevel(
  answers: Answers,
  id: string,
  levels: string[],
  fallback: number,
  seed: number,
  floor = 0,
): { index: number; a?: Extract<Answer, { type: 'score' }> } {
  const a = answers[id]
  if (a?.type !== 'score') return { index: fallback }
  const key = seed
    ? pick(a.probabilities, seed, id, floor)
    : String(Math.round(a.score))
  const index = Number(key)
  return {
    index: Number.isFinite(index)
      ? Math.max(0, Math.min(levels.length - 1, Math.round(index)))
      : fallback,
    a,
  }
}

export function noulYes(answers: Answers, id: string): number {
  const a = answers[id]
  return a?.type === 'noul' ? a.noul : 0
}

export function decide(
  seat: Seat,
  id: string,
  label: string,
  picked: string,
  a?: Answer,
): Decision | undefined {
  if (!a) return
  if (a.type === 'choice')
    return {
      id,
      seat,
      label,
      picked,
      options: rank(a.probabilities),
      confidence: a.confidence,
    }
  if (a.type === 'score')
    return {
      id,
      seat,
      label,
      picked,
      options: rank(a.probabilities).map((o) => ({ key: o.key, p: o.p })),
      confidence: a.confidence,
    }
  return {
    id,
    seat,
    label,
    picked,
    options: [
      { key: 'yes', p: a.noul },
      { key: 'no', p: 1 - a.noul },
    ],
  }
}

export function sampledNoul(answers: Answers, id: string, seed: number) {
  return noise(seed, id) < noulYes(answers, id)
}
