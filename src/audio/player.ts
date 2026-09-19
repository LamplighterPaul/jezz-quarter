import type { Bar, Note, Seat, Snapshot } from '../../shared/types.ts'
import { Kit } from './kit.ts'

export interface Hooks {
  onSnapshot(s: Snapshot): void
  onBar(bar: Bar): void
  onPulse(seat: Seat): void
  onStatus(status: 'connecting' | 'connected' | 'reconnecting'): void
  onError(message: string): void
  onReaction(
    accepted: boolean,
    retryAfterMs: number,
    reaction?: string,
    message?: string,
  ): void
  onAudience(reaction: string): void
}

/** The room connection and visual clock keep running with sound off. */
export class Player {
  private ws: WebSocket | null = null
  private ctx: AudioContext | null = null
  private kit: Kit | null = null
  private timers = new Set<number>()
  private reconnectTimer: number | undefined
  private originPerf = 0
  private disposed = false
  private connecting = false
  private muted = true
  private bars = new Map<number, Bar>()
  private readonly hooks: Hooks

  constructor(hooks: Hooks) {
    this.hooks = hooks
  }

  async setMuted(muted: boolean) {
    if (!muted && !this.ctx) {
      this.ctx = new AudioContext()
      this.kit = new Kit(this.ctx)
      this.kit.setMuted(true)
      try {
        await this.ctx.resume()
      } catch (e) {
        await this.ctx.close()
        this.ctx = null
        this.kit = null
        throw e
      }
      if (this.disposed) {
        await this.ctx.close()
        return
      }
      for (const bar of this.bars.values()) this.scheduleAudio(bar)
    } else if (!muted && this.ctx?.state === 'suspended') {
      await this.ctx.resume()
    }
    this.muted = muted
    this.kit?.setMuted(muted)
  }

  async connect() {
    if (this.disposed || this.ws || this.connecting) return
    this.connecting = true
    this.hooks.onStatus('connecting')
    try {
      const response = await fetch('/api/guest', { cache: 'no-store' })
      if (!response.ok) throw new Error('Room unavailable')
    } catch {
      this.connecting = false
      if (!this.disposed) {
        this.hooks.onStatus('reconnecting')
        this.reconnectTimer = window.setTimeout(() => void this.connect(), 1500)
      }
      return
    }
    this.connecting = false
    if (this.disposed) return
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = (this.ws = new WebSocket(`${proto}://${location.host}/ws`))
    ws.onopen = () => {
      if (!this.disposed) this.hooks.onStatus('connected')
    }
    ws.onmessage = (ev) => {
      if (this.disposed) return
      try {
        this.onMessage(JSON.parse(ev.data as string) as Msg)
      } catch {
        this.hooks.onError('The room sent an unreadable update. Reconnecting…')
        ws.close()
      }
    }
    ws.onclose = () => {
      if (this.disposed) return
      this.ws = null
      this.hooks.onStatus('reconnecting')
      this.clearTimers()
      this.bars.clear()
      this.kit?.setMuted(true)
      this.reconnectTimer = window.setTimeout(() => this.connect(), 1500)
    }
    ws.onerror = () => ws.close()
  }

  react(reaction: 'cheer' | 'boo') {
    if (this.ws?.readyState !== WebSocket.OPEN) return false
    this.ws.send(JSON.stringify({ type: 'react', reaction }))
    return true
  }

  dispose() {
    this.disposed = true
    window.clearTimeout(this.reconnectTimer)
    this.clearTimers()
    this.ws?.close()
    this.ws = null
    if (this.ctx && this.ctx.state !== 'closed') void this.ctx.close()
  }

  private onMessage(msg: Msg) {
    if (msg.snapshot) this.hooks.onSnapshot(msg.snapshot)
    if (msg.type === 'hello' && msg.retryAfterMs)
      this.hooks.onReaction(false, msg.retryAfterMs)
    if (msg.type === 'reaction')
      this.hooks.onReaction(
        !!msg.accepted,
        msg.retryAfterMs ?? 0,
        msg.reaction,
        msg.message,
      )
    if (msg.type === 'audience' && msg.reaction)
      this.hooks.onAudience(msg.reaction)
    if ((msg.type === 'hello' || msg.type === 'resumed') && msg.snapshot) {
      this.originPerf = performance.now() - msg.snapshot.elapsedMs
      this.clearTimers()
      this.bars.clear()
      this.kit?.setMuted(this.muted)
      if (msg.snapshot.playing)
        for (const bar of msg.snapshot.bars) this.schedule(bar)
    }
    if (msg.type === 'bar' && msg.bar) {
      this.hooks.onError('')
      this.schedule(msg.bar)
    }
    if (msg.type === 'paused') this.clearTimers()
    if (msg.type === 'error' && msg.error) this.hooks.onError(msg.error)
  }

  private schedule(bar: Bar) {
    if (this.bars.has(bar.index)) return
    const nowSong = (performance.now() - this.originPerf) / 1000
    if (bar.at + (bar.beats * 60) / bar.bpm <= nowSong) return
    for (const [index, previous] of this.bars) {
      if (previous.at + (previous.beats * 60) / previous.bpm < nowSong)
        this.bars.delete(index)
    }
    this.bars.set(bar.index, bar)
    this.after(bar.at, () => this.hooks.onBar(bar))
    for (const note of bar.notes) {
      const at = bar.at + (note.at * 60) / bar.bpm
      if (at >= nowSong - 0.05)
        this.after(at, () => this.hooks.onPulse(note.seat))
    }
    this.scheduleAudio(bar)
  }

  private scheduleAudio(bar: Bar) {
    if (!this.kit || !this.ctx) return
    const beat = 60 / bar.bpm
    const delay = bar.at - (performance.now() - this.originPerf) / 1000
    const start = this.ctx.currentTime + delay
    for (const note of bar.notes) this.play(note, start, beat)
  }

  private play(n: Note, start: number, beat: number) {
    const kit = this.kit
    if (!kit) return
    const at = start + n.at * beat
    if (at < kit.ctx.currentTime) return
    const hold = Math.max(0.05, n.beats * beat * 0.9)
    if (n.seat === 'piano') kit.piano(n.midi, at, hold, n.velocity)
    else if (n.seat === 'bass') kit.bass(n.midi, at, hold, n.velocity)
    else if (n.seat === 'horn') kit.horn(n.midi, at, hold, n.velocity)
    else kit.drum(n.kind ?? 'hat', at, n.velocity)
  }

  private after(songTime: number, fn: () => void) {
    const ms = Math.max(
      0,
      this.originPerf + songTime * 1000 - performance.now(),
    )
    const timer = window.setTimeout(() => {
      this.timers.delete(timer)
      if (!this.disposed) fn()
    }, ms)
    this.timers.add(timer)
  }

  private clearTimers() {
    for (const timer of this.timers) window.clearTimeout(timer)
    this.timers.clear()
  }
}

type Msg = {
  type: string
  snapshot?: Snapshot
  bar?: Bar
  error?: string
  accepted?: boolean
  retryAfterMs?: number
  reaction?: string
  message?: string
}
