// One POST, many questions, probabilities back. This service has one key.

import { Agent, fetch as ufetch } from 'undici'
import { setTimeout as delay } from 'node:timers/promises'
import type { Answer, Answers, Questions } from '../shared/types.ts'

export interface Run {
  answers: Answers
  model: string
  ms: number
  questions: number
  inputTokens: number
}

const KEY = (process.env.TYPESAFE_API_KEY ?? '').trim()
const MODEL = process.env.TYPESAFE_MODEL ?? 'jev-latest'
const ENDPOINT =
  process.env.TYPESAFE_ENDPOINT ?? 'https://api.typesafe.ai/v1/systemone'
const agent = new Agent({ keepAliveTimeout: 30_000, connections: 8 })

export const live = () => KEY.length > 0

export async function ask(
  state: unknown,
  questions: Questions,
  signal?: AbortSignal,
): Promise<Run> {
  return KEY ? jev(state, questions, signal) : mock(questions)
}

async function jev(
  state: unknown,
  questions: Questions,
  signal?: AbortSignal,
): Promise<Run> {
  const started = performance.now()
  for (let attempt = 0; ; attempt++) {
    const res = await ufetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ state, model: MODEL, questions }),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(20_000)])
        : AbortSignal.timeout(20_000),
      dispatcher: agent,
    })
    if ((res.status === 429 || res.status === 529) && attempt < 3) {
      await res.body?.cancel()
      await delay(400 * 2 ** attempt, undefined, { signal })
      continue
    }
    if (!res.ok)
      throw new Error(
        `Jev returned ${res.status}: ${(await res.text()).slice(0, 300)}`,
      )
    const body = (await res.json()) as {
      model: string
      answers: Answers
      usage?: { input_tokens?: number }
    }
    return {
      answers: body.answers,
      model: body.model,
      ms: Math.round(performance.now() - started),
      questions: Object.keys(questions).length,
      inputTokens: body.usage?.input_tokens ?? 0,
    }
  }
}

function mock(questions: Questions): Run {
  const answers: Answers = {}
  for (const [id, q] of Object.entries(questions)) {
    let a: Answer
    if (q.type === 'noul') a = { type: 'noul', noul: Math.random() }
    else if (q.type === 'choice') {
      const keys = Object.keys(q.criteria)
      const raw = keys.map(() => Math.random() ** 3)
      const sum = raw.reduce((x, y) => x + y, 0)
      const probabilities = Object.fromEntries(
        keys.map((k, i) => [k, raw[i] / sum]),
      )
      const choice = keys[raw.indexOf(Math.max(...raw))]
      a = {
        type: 'choice',
        choice,
        probabilities,
        confidence: probabilities[choice],
      }
    } else {
      const n = q.criteria.length
      const raw = q.criteria.map(() => Math.random())
      const sum = raw.reduce((x, y) => x + y, 0)
      const probabilities = Object.fromEntries(
        q.criteria.map((_, i) => [String(i), raw[i] / sum]),
      )
      a = {
        type: 'score',
        score: raw.indexOf(Math.max(...raw)),
        confidence: 1 / n,
        probabilities,
      }
    }
    answers[id] = a
  }
  return {
    answers,
    model: 'mock',
    ms: 0,
    questions: Object.keys(questions).length,
    inputTokens: 0,
  }
}
