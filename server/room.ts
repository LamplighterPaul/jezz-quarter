import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { dirname } from 'node:path'
import { AudienceFeedback, type Reaction } from './feedback.ts'
import { listeningState } from './listening.ts'
import { RoomClock } from './clock.ts'
import { assembleBass, bassQuestions } from '../shared/musicians/bass.ts'
import { assembleDrums, drumsQuestions } from '../shared/musicians/drums.ts'
import { assembleHorn, hornQuestions } from '../shared/musicians/horn.ts'
import { assemblePiano, pianoQuestions } from '../shared/musicians/piano.ts'
import { beatsPerBar, renderBar, type RenderState } from '../shared/render.ts'
import {
  USD_PER_TOKEN,
  type Bar,
  type Heard,
  type Snapshot,
  type Stats,
} from '../shared/types.ts'
import { ask, live } from './jev.ts'

export const BPM = Number(process.env.BPM ?? 88)
const DATA = process.env.STATS_FILE ?? './data/stats.json'
const KEEP_BARS = 48
const DAILY_USD_CAP = Number(process.env.DAILY_USD_CAP ?? 3)

type Client = { id: string; send(data: string): void }

export class Room {
  visitors = 0
  private clock = new RoomClock()
  get playing() {
    return this.clock.playing
  }
  bars: Bar[] = []
  private legacyStats: unknown
  private countingSince = new Date().toISOString()
  private barCount = 0
  private tempo = BPM
  readonly feedback = new AudienceFeedback()
  private persistChain = Promise.resolve()
  get bpm() {
    return (
      this.bars.findLast((bar) => bar.at <= this.elapsed() / 1000)?.bpm ??
      this.tempo
    )
  }
  private clients = new Set<Client>()
  private render: RenderState = { lastVoicing: [], lastBass: 38, lastHorn: 64 }
  private looping = false
  private seed = (Date.now() ^ 0x9e3779b9) >>> 0
  private spent = 0
  private day = new Date().toISOString().slice(0, 10)

  async boot() {
    try {
      const raw = JSON.parse(await readFile(DATA, 'utf8'))
      if (raw.version === 2) {
        const minutes = Number(raw.minutesPlayed)
        this.clock = new RoomClock(
          Number.isFinite(minutes) ? Math.max(0, minutes) : 0,
        )
        this.countingSince = raw.countingSince ?? this.countingSince
        this.legacyStats = raw.legacyStats
        if (raw.day === this.day) this.spent = Number(raw.spent) || 0
      } else {
        // Old totals double-counted every pause/resume. Retain the original
        // reading for reference, but never present it as measured play time.
        this.legacyStats = raw
      }
    } catch {
      /* first night */
    }
    setInterval(() => {
      void this.persist()
    }, 30_000).unref()
  }

  async shutdown() {
    this.clock.pause()
    await this.persist()
  }

  snapshot(): Snapshot {
    return {
      bpm: this.bpm,
      playing: this.playing,
      visitors: this.visitors,
      minutesPlayed: this.clock.minutesPlayed,
      countingSince: this.countingSince,
      barsPlayed: this.barCount,
      elapsedMs: this.elapsed(),
      bars: this.bars.slice(-KEEP_BARS),
      mock: !live(),
    }
  }

  join(client: Client) {
    this.clients.add(client)
    this.visitors = new Set([...this.clients].map((c) => c.id)).size
    client.send(
      JSON.stringify({
        type: 'hello',
        snapshot: this.snapshot(),
        retryAfterMs: this.feedback.remaining(client.id),
      }),
    )
    this.broadcastStats()
    if (this.visitors === 1) this.resume()
  }

  leave(client: Client) {
    if (!this.clients.delete(client)) return
    this.visitors = new Set([...this.clients].map((c) => c.id)).size
    this.broadcastStats()
    if (this.visitors === 0) this.pause()
  }

  react(client: Client, reaction: Reaction) {
    const current = this.bars.findLast((bar) => bar.at <= this.elapsed() / 1000)
    if (!current) {
      client.send(
        JSON.stringify({
          type: 'reaction',
          accepted: false,
          retryAfterMs: 0,
          message: 'Let the band play a little first.',
        }),
      )
      return
    }
    const result = this.feedback.react(client.id, reaction, current.index)
    for (const other of this.clients)
      if (other.id === client.id)
        other.send(JSON.stringify({ type: 'reaction', ...result, reaction }))
    if (result.accepted) this.broadcast({ type: 'audience', reaction })
  }

  private elapsed() {
    return this.clock.elapsedMs
  }

  private pause() {
    if (!this.playing) return
    this.clock.pause()
    this.broadcast({ type: 'paused', snapshot: this.snapshot() })
    void this.persist()
  }

  private resume() {
    if (this.playing) return
    this.clock.resume()
    this.broadcast({ type: 'resumed', snapshot: this.snapshot() })
    void this.loop()
  }

  private broadcast(msg: unknown) {
    const data = JSON.stringify(msg)
    for (const c of this.clients) {
      try {
        c.send(data)
      } catch {
        /* gone */
      }
    }
  }

  private broadcastStats() {
    this.broadcast({ type: 'stats', snapshot: this.snapshot() })
  }

  private persist() {
    const data = JSON.stringify(
      {
        version: 2,
        minutesPlayed: this.clock.minutesPlayed,
        countingSince: this.countingSince,
        legacyStats: this.legacyStats,
        day: this.day,
        spent: this.spent,
      },
      null,
      2,
    )
    this.persistChain = this.persistChain
      .then(async () => {
        await mkdir(dirname(DATA), { recursive: true })
        const temporary = `${DATA}.${randomUUID()}.tmp`
        await writeFile(temporary, data)
        await rename(temporary, DATA)
      })
      .catch(() => {
        /* disk trouble must not stop the band */
      })
    return this.persistChain
  }

  private heard(): Heard {
    const last = this.bars.at(-1)
    const recent = this.bars.slice(-4)
    return {
      barsSoFar: this.barCount,
      bpm: this.tempo,
      last: last
        ? `bar ${last.index}: piano ${last.parts.piano.heard}; bass ${last.parts.bass.heard}; drums ${last.parts.drums.heard}; horn ${last.parts.horn.heard}`
        : 'the room is quiet. this is the first bar of the night. there is no chart.',
      recent:
        recent
          .map(
            (b) =>
              `${b.index}: p ${b.parts.piano.heard} / b ${b.parts.bass.heard} / d ${b.parts.drums.heard} / h ${b.parts.horn.heard}`,
          )
          .join(' · ') || 'nothing yet',
    }
  }

  private async nextBar(): Promise<Bar> {
    const heard = this.heard()
    const audience = this.feedback.recent(this.barCount)
    const stateFor = (seat: import('../shared/types.ts').Seat) =>
      listeningState(seat, this.bars, this.tempo, audience)
    const today = new Date().toISOString().slice(0, 10)
    if (today !== this.day) {
      this.day = today
      this.spent = 0
    }
    if (this.spent >= DAILY_USD_CAP)
      throw new Error(
        'The daily budget for this room is spent. It resets at midnight UTC.',
      )
    const seed = (this.seed =
      (Math.imul(this.seed, 1664525) + 1013904223) >>> 0)
    // Four separate harnesses. Same heard facts. Four independent calls.
    const [pianoRun, bassRun, drumsRun, hornRun] = await Promise.all([
      ask(stateFor('piano'), pianoQuestions(heard)),
      ask(stateFor('bass'), bassQuestions(heard)),
      ask(stateFor('drums'), drumsQuestions(heard)),
      ask(stateFor('horn'), hornQuestions(heard)),
    ])
    const piano = assemblePiano(pianoRun.answers, heard, seed ^ 1)
    const bass = assembleBass(bassRun.answers, heard, seed ^ 2)
    const drums = assembleDrums(drumsRun.answers, heard, seed ^ 3)
    const horn = assembleHorn(hornRun.answers, heard, seed ^ 4)
    this.tempo = drums.part.bpm
    const index = this.barCount++
    const last = this.bars.at(-1)
    const at = Math.max(
      last ? last.at + (last.beats * 60) / last.bpm : 0,
      this.elapsed() / 1000 + 0.25,
    )
    const bar: Bar = {
      index,
      bpm: this.tempo,
      at,
      beats: beatsPerBar,
      parts: {
        piano: piano.part,
        bass: bass.part,
        drums: drums.part,
        horn: horn.part,
      },
      notes: [],
      decisions: [
        ...piano.decisions,
        ...bass.decisions,
        ...drums.decisions,
        ...horn.decisions,
      ],
      stats: statsOf(pianoRun, bassRun, drumsRun, hornRun),
    }
    bar.notes = renderBar(bar, this.render)
    this.spent += bar.stats.usd
    this.bars.push(bar)
    if (this.bars.length > 400) this.bars = this.bars.slice(-KEEP_BARS)
    return bar
  }

  private async loop() {
    if (this.looping) return
    this.looping = true
    try {
      while (this.playing && this.visitors > 0) {
        const bar = await this.nextBar()
        this.broadcast({ type: 'bar', bar, snapshot: this.snapshot() })
        const duration = (bar.beats * 60) / bar.bpm
        const due = bar.at + duration
        const wait =
          due * 1000 - this.elapsed() - Math.min(1600, duration * 750)
        if (wait > 0) await sleep(wait)
      }
    } catch (e) {
      this.broadcast({
        type: 'error',
        error: e instanceof Error ? e.message : 'the band stopped',
      })
      if (this.playing && this.visitors > 0) {
        const delay = this.spent >= DAILY_USD_CAP ? 60_000 : 3000
        setTimeout(() => {
          if (this.playing && this.visitors > 0) void this.loop()
        }, delay).unref()
      }
    } finally {
      this.looping = false
    }
  }
}

function statsOf(
  ...runs: Array<{
    model: string
    ms: number
    questions: number
    inputTokens: number
  }>
): Stats {
  const inputTokens = runs.reduce((n, r) => n + r.inputTokens, 0)
  return {
    model: runs[0]?.model ?? 'jev',
    ms: runs.reduce((n, r) => n + r.ms, 0),
    questions: runs.reduce((n, r) => n + r.questions, 0),
    inputTokens,
    usd: inputTokens * USD_PER_TOKEN,
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
