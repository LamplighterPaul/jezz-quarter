import type { Bar, Note, Snapshot } from '../../shared/types.ts'
import { Kit } from './kit.ts'

export interface Hooks {
  onSnapshot(s: Snapshot): void
  onBar(bar: Bar): void
  onKeys(midi: number[]): void
  onError(message: string): void
}

export class Player {
  private ws: WebSocket | null = null
  private ctx: AudioContext | null = null
  private kit: Kit | null = null
  private timers: number[] = []
  private originPerf = 0
  private bpm = 88
  private down = new Map<number, number>()
  private armed = false
  private readonly hooks: Hooks

  constructor(hooks: Hooks) { this.hooks = hooks }

  async arm() {
    if (this.armed) return
    this.ctx = new AudioContext()
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    this.kit = new Kit(this.ctx)
    this.armed = true
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    this.ws = new WebSocket(`${proto}://${location.host}/ws`)
    this.ws.onmessage = ev => this.onMessage(JSON.parse(ev.data as string) as Msg)
    this.ws.onclose = () => setTimeout(() => this.connect(), 1500)
  }

  private onMessage(msg: Msg) {
    if (msg.snapshot) this.hooks.onSnapshot(msg.snapshot)
    if (msg.type === 'hello' && msg.snapshot) {
      this.bpm = msg.snapshot.bpm
      this.originPerf = performance.now() - msg.snapshot.elapsedMs
      if (msg.snapshot.playing) for (const bar of msg.snapshot.bars) this.schedule(bar)
    }
    if (msg.type === 'bar' && msg.bar) {
      this.hooks.onBar(msg.bar)
      this.schedule(msg.bar)
    }
    if (msg.type === 'paused') this.clearTimers()
    if (msg.type === 'resumed' && msg.snapshot) {
      this.originPerf = performance.now() - msg.snapshot.elapsedMs
    }
    if (msg.type === 'error' && msg.error) this.hooks.onError(msg.error)
  }

  private schedule(bar: Bar) {
    if (!this.armed || !this.kit || !this.ctx) return
    const beat = 60 / this.bpm
    const songAt = (bar.at) * 1000
    const nowSong = performance.now() - this.originPerf
    const delay = (songAt - nowSong) / 1000
    const start = this.ctx.currentTime + delay
    for (const n of bar.notes) this.play(n, start, beat)
    this.after(start, () => this.hooks.onBar(bar))
  }

  private play(n: Note, start: number, beat: number) {
    const kit = this.kit
    if (!kit) return
    const at = start + n.at * beat
    if (at < kit.ctx.currentTime - 0.05) return
    const hold = Math.max(0.05, n.beats * beat * 0.9)
    if (n.seat === 'piano') kit.piano(n.midi, at, hold, n.velocity)
    else if (n.seat === 'bass') kit.bass(n.midi, at, hold, n.velocity)
    else if (n.seat === 'horn') kit.horn(n.midi, at, hold, n.velocity)
    else kit.drum(n.kind ?? 'hat', at, n.velocity)
    if (n.seat !== 'drums') {
      this.after(at, () => this.press(n.midi, 1))
      this.after(at + hold, () => this.press(n.midi, -1))
    }
  }

  private press(midi: number, delta: number) {
    const n = (this.down.get(midi) ?? 0) + delta
    if (n > 0) this.down.set(midi, n)
    else this.down.delete(midi)
    this.hooks.onKeys([...this.down.keys()])
  }

  private after(audioTime: number, fn: () => void) {
    const ctx = this.ctx
    if (!ctx) return
    const ms = Math.max(0, (audioTime - ctx.currentTime) * 1000)
    this.timers.push(window.setTimeout(fn, ms))
  }

  private clearTimers() {
    for (const t of this.timers) clearTimeout(t)
    this.timers = []
  }
}

type Msg = {
  type: string
  snapshot?: Snapshot
  bar?: Bar
  error?: string
}
