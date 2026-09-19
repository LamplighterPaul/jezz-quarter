import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { assembleBass, bassQuestions } from '../shared/musicians/bass.ts'
import { assembleDrums, drumsQuestions } from '../shared/musicians/drums.ts'
import { assembleHorn, hornQuestions } from '../shared/musicians/horn.ts'
import { assemblePiano, pianoQuestions } from '../shared/musicians/piano.ts'
import { beatsPerBar, renderBar, type RenderState } from '../shared/render.ts'
import { USD_PER_TOKEN, type Bar, type Heard, type Snapshot, type Stats } from '../shared/types.ts'
import { ask, live } from './jev.ts'

export const BPM = Number(process.env.BPM ?? 88)
const DATA = process.env.STATS_FILE ?? './data/stats.json'
const KEEP_BARS = 48
const DAILY_USD_CAP = Number(process.env.DAILY_USD_CAP ?? 3)
const beat = 60 / BPM

type Client = { send(data: string): void }

export class Room {
  visitors = 0
  playing = false
  bars: Bar[] = []
  minutesPlayed = 0
  private frozenMs = 0
  private origin = Date.now()
  private clients = new Set<Client>
  private render: RenderState = { lastVoicing: [], lastBass: 38, lastHorn: 64 }
  private looping = false
  private seed = (Date.now() ^ 0x9e3779b9) >>> 0
  private spent = 0
  private day = new Date().toISOString().slice(0, 10)

  async boot() {
    try {
      const raw = JSON.parse(await readFile(DATA, 'utf8')) as { minutesPlayed?: number }
      this.minutesPlayed = Number(raw.minutesPlayed) || 0
    } catch { /* first night */ }
    setInterval(() => { void this.persist() }, 30_000)
  }

  snapshot(): Snapshot {
    return {
      bpm: BPM,
      playing: this.playing,
      visitors: this.visitors,
      minutesPlayed: this.minutesPlayed + (this.playing ? this.elapsed() / 60000 : 0),
      barsPlayed: this.bars.length,
      elapsedMs: this.elapsed(),
      bars: this.bars.slice(-KEEP_BARS),
      mock: !live(),
    }
  }

  join(client: Client) {
    this.clients.add(client)
    this.visitors = this.clients.size
    client.send(JSON.stringify({ type: 'hello', snapshot: this.snapshot() }))
    this.broadcastStats()
    if (this.visitors === 1) this.resume()
  }

  leave(client: Client) {
    this.clients.delete(client)
    this.visitors = this.clients.size
    this.broadcastStats()
    if (this.visitors === 0) this.pause()
  }

  private elapsed() {
    if (!this.playing) return this.frozenMs
    return this.frozenMs + (Date.now() - this.origin)
  }

  private pause() {
    if (!this.playing) return
    this.minutesPlayed += this.elapsed() / 60000
    this.frozenMs = this.elapsed()
    this.playing = false
    this.broadcast({ type: 'paused', snapshot: this.snapshot() })
    void this.persist()
  }

  private resume() {
    if (this.playing) return
    this.origin = Date.now()
    this.playing = true
    this.broadcast({ type: 'resumed', snapshot: this.snapshot() })
    void this.loop()
  }

  private broadcast(msg: unknown) {
    const data = JSON.stringify(msg)
    for (const c of this.clients) {
      try { c.send(data) } catch { /* gone */ }
    }
  }

  private broadcastStats() {
    this.broadcast({ type: 'stats', snapshot: this.snapshot() })
  }

  private async persist() {
    try {
      await mkdir('data', { recursive: true })
      const minutes = this.minutesPlayed + (this.playing ? this.elapsed() / 60000 : 0)
      await writeFile(DATA, JSON.stringify({ minutesPlayed: minutes, bars: this.bars.length }, null, 2))
    } catch { /* disk full is not a reason to stop the band */ }
  }

  private heard(): Heard {
    const last = this.bars.at(-1)
    const recent = this.bars.slice(-4)
    return {
      barsSoFar: this.bars.length,
      last: last
        ? `bar ${last.index}: piano ${last.parts.piano.heard}; bass ${last.parts.bass.heard}; drums ${last.parts.drums.heard}; horn ${last.parts.horn.heard}`
        : 'the room is quiet. this is the first bar of the night. there is no chart.',
      recent: recent.map(b => `${b.index}: p ${b.parts.piano.heard} / b ${b.parts.bass.heard} / d ${b.parts.drums.heard} / h ${b.parts.horn.heard}`).join(' · ')
        || 'nothing yet',
    }
  }

  private async nextBar(): Promise<Bar> {
    const heard = this.heard()
    const state = {
      room: 'a small club, free jazz, no lead sheet, no prompt, no leader',
      bpm: BPM,
      heard: heard.last,
      recent: heard.recent,
      bars_so_far: heard.barsSoFar,
    }
    const today = new Date().toISOString().slice(0, 10)
    if (today !== this.day) { this.day = today; this.spent = 0 }
    if (this.spent >= DAILY_USD_CAP) throw new Error('The daily budget for this room is spent. It resets at midnight UTC.')
    const seed = (this.seed = Math.imul(this.seed, 1664525) + 1013904223 >>> 0)
    // Four separate harnesses. Same heard facts. Four independent calls.
    const [pianoRun, bassRun, drumsRun, hornRun] = await Promise.all([
      ask(state, pianoQuestions(heard)),
      ask(state, bassQuestions(heard)),
      ask(state, drumsQuestions(heard)),
      ask(state, hornQuestions(heard)),
    ])
    const piano = assemblePiano(pianoRun.answers, heard, seed ^ 1)
    const bass = assembleBass(bassRun.answers, heard, seed ^ 2)
    const drums = assembleDrums(drumsRun.answers, heard, seed ^ 3)
    const horn = assembleHorn(hornRun.answers, heard, seed ^ 4)
    const index = this.bars.length
    const last = this.bars.at(-1)
    const at = last ? last.at + last.beats * beat : this.elapsed() / 1000
    const bar: Bar = {
      index,
      at,
      beats: beatsPerBar,
      parts: { piano: piano.part, bass: bass.part, drums: drums.part, horn: horn.part },
      notes: [],
      decisions: [...piano.decisions, ...bass.decisions, ...drums.decisions, ...horn.decisions],
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
        const due = bar.at + bar.beats * beat
        const wait = due * 1000 - this.elapsed() - 800
        if (wait > 0) await sleep(wait)
      }
    } catch (e) {
      this.broadcast({ type: 'error', error: e instanceof Error ? e.message : 'the band stopped' })
    } finally {
      this.looping = false
    }
  }
}

function statsOf(...runs: Array<{ model: string; ms: number; questions: number; inputTokens: number }>): Stats {
  const inputTokens = runs.reduce((n, r) => n + r.inputTokens, 0)
  return {
    model: runs[0]?.model ?? 'jev',
    ms: runs.reduce((n, r) => n + r.ms, 0),
    questions: runs.reduce((n, r) => n + r.questions, 0),
    inputTokens,
    usd: inputTokens * USD_PER_TOKEN,
  }
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
