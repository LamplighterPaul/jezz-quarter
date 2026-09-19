import type { Seat } from '../../shared/types.ts'
import { defaultMix, mixGains, MIX_SEATS, type Mix } from './mix.ts'
import { midiHz } from '../../shared/theory.ts'

function room(ctx: AudioContext, seconds = 1.6): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(2, n, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < n; i++) {
      const t = i / n
      data[i] =
        (Math.random() * 2 - 1) *
        Math.pow(1 - t, 2.4) *
        (1 - Math.exp(-i / 400))
    }
  }
  return buffer
}

export class Kit {
  readonly ctx: AudioContext
  private readonly channels: Record<
    Seat,
    { dry: GainNode; wet: GainNode; output: GainNode }
  >
  private readonly out: GainNode
  private noise: AudioBuffer | null = null

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.out = ctx.createGain()
    this.out.gain.value = 0.34
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.ratio.value = 3
    comp.attack.value = 0.004
    comp.release.value = 0.22
    const impulse = room(ctx)
    this.channels = Object.fromEntries(
      MIX_SEATS.map((seat) => {
        const output = ctx.createGain()
        const dry = ctx.createGain()
        const wet = ctx.createGain()
        dry.gain.value = 0.84
        wet.gain.value = 0.22
        dry.connect(output)
        if (seat === 'piano' || seat === 'horn') {
          const verb = ctx.createConvolver()
          verb.buffer = impulse
          wet.connect(verb).connect(output)
        }
        // Per-instrument output follows its reverb, so mute removes tails too.
        output.connect(comp)
        return [seat, { dry, wet, output }]
      }),
    ) as Record<Seat, { dry: GainNode; wet: GainNode; output: GainNode }>
    comp.connect(this.out).connect(ctx.destination)
    this.setMix(defaultMix())
  }

  setMix(mix: Mix) {
    const gains = mixGains(mix)
    for (const seat of MIX_SEATS) {
      const gain = this.channels[seat].output.gain
      gain.cancelScheduledValues(this.ctx.currentTime)
      gain.setValueAtTime(gains[seat], this.ctx.currentTime)
      gain.value = gains[seat]
    }
  }

  setMuted(muted: boolean) {
    const now = this.ctx.currentTime
    this.out.gain.cancelScheduledValues(now)
    if (muted) {
      // Immediate local silence, including reverb and already scheduled notes.
      this.out.gain.setValueAtTime(0, now)
      this.out.gain.value = 0
    } else {
      this.out.gain.setTargetAtTime(0.34, now, 0.012)
    }
  }

  piano(midi: number, at: number, hold: number, velocity: number) {
    const ctx = this.ctx
    const f = midiHz(midi)
    const v = Math.max(0.03, Math.min(1, velocity))
    const ring = Math.min(
      10 * Math.pow(0.5, (midi - 24) / 26) + 0.3,
      hold + 0.4,
    )
    const end = at + ring + 0.08
    const body = ctx.createGain()
    body.connect(this.channels.piano.dry)
    body.connect(this.channels.piano.wet)
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 900 + 7000 * v * v
    tone.connect(body)
    ;[1, 2, 3, 4, 5, 6].forEach((n, i) => {
      if (f * n > ctx.sampleRate / 2.2) return
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = f * n * Math.sqrt(1 + 0.00042 * n * n)
      const g = ctx.createGain()
      const peak = [1, 0.4, 0.22, 0.12, 0.07, 0.035][i] * v * 0.24
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + 0.004)
      g.gain.exponentialRampToValueAtTime(
        0.0001,
        at + Math.max(0.05, ring / (1 + 0.6 * i)),
      )
      osc.connect(g).connect(tone)
      osc.start(at)
      osc.stop(end)
    })
    body.gain.setValueAtTime(1, at + Math.max(0.02, hold))
    body.gain.exponentialRampToValueAtTime(
      0.0001,
      at + Math.max(0.05, hold) + 0.35,
    )
  }

  bass(midi: number, at: number, hold: number, velocity: number) {
    const ctx = this.ctx
    const f = midiHz(midi)
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = f
    const sub = ctx.createOscillator()
    sub.type = 'sine'
    sub.frequency.value = f * 0.5
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(0.55 * velocity, at + 0.01)
    g.gain.exponentialRampToValueAtTime(
      0.0001,
      at + Math.max(0.08, hold + 0.12),
    )
    osc.connect(g)
    sub.connect(g)
    g.connect(this.channels.bass.dry)
    osc.start(at)
    osc.stop(at + hold + 0.2)
    sub.start(at)
    sub.stop(at + hold + 0.2)
  }

  horn(midi: number, at: number, hold: number, velocity: number) {
    const ctx = this.ctx
    const f = midiHz(midi)
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = f
    const filt = ctx.createBiquadFilter()
    filt.type = 'lowpass'
    filt.frequency.setValueAtTime(900 + 2200 * velocity, at)
    filt.frequency.exponentialRampToValueAtTime(400, at + hold)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(0.15 * velocity, at + 0.03)
    g.gain.setValueAtTime(0.12 * velocity, at + Math.max(0.05, hold - 0.05))
    g.gain.exponentialRampToValueAtTime(0.0001, at + hold + 0.08)
    osc.connect(filt).connect(g).connect(this.channels.horn.dry)
    g.connect(this.channels.horn.wet)
    osc.start(at)
    osc.stop(at + hold + 0.12)
  }

  drum(kind: string, at: number, velocity: number) {
    const ctx = this.ctx
    if (kind === 'kick') {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(140, at)
      osc.frequency.exponentialRampToValueAtTime(38, at + 0.12)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.9 * velocity, at)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22)
      osc.connect(g).connect(this.channels.drums.dry)
      osc.start(at)
      osc.stop(at + 0.25)
      return
    }
    if (kind === 'tom' || kind === 'rim') {
      const osc = ctx.createOscillator()
      osc.type = kind === 'rim' ? 'triangle' : 'sine'
      osc.frequency.setValueAtTime(kind === 'rim' ? 1400 : 220, at)
      osc.frequency.exponentialRampToValueAtTime(
        kind === 'rim' ? 650 : 85,
        at + 0.13,
      )
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.5 * velocity, at)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16)
      osc.connect(gain).connect(this.channels.drums.dry)
      osc.start(at)
      osc.stop(at + 0.18)
      return
    }
    const duration =
      kind === 'brush'
        ? 0.65
        : kind === 'ride'
          ? 0.38
          : kind === 'snare'
            ? 0.2
            : 0.1
    const src = ctx.createBufferSource()
    src.buffer = this.burst(duration)
    const filter = ctx.createBiquadFilter()
    filter.type = kind === 'snare' || kind === 'brush' ? 'bandpass' : 'highpass'
    filter.frequency.value =
      kind === 'snare'
        ? 1600
        : kind === 'brush'
          ? 3200
          : kind === 'ride'
            ? 4200
            : 6200
    filter.Q.value = 0.6
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.001, velocity * (kind === 'brush' ? 0.7 : 0.8)),
      at + 0.003,
    )
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration)
    src.connect(filter).connect(gain).connect(this.channels.drums.dry)
    src.start(at)
    src.stop(at + duration)
    if (kind === 'snare' || kind === 'ride') {
      const body = ctx.createOscillator()
      body.type = kind === 'snare' ? 'triangle' : 'sine'
      body.frequency.value = kind === 'snare' ? 185 : 3100
      const bodyGain = ctx.createGain()
      bodyGain.gain.setValueAtTime(
        (kind === 'snare' ? 0.3 : 0.09) * velocity,
        at,
      )
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, at + duration * 0.8)
      body.connect(bodyGain).connect(this.channels.drums.dry)
      body.start(at)
      body.stop(at + duration)
    }
  }

  private burst(seconds: number): AudioBuffer {
    if (this.noise && this.noise.duration >= seconds) return this.noise
    const n = Math.floor(this.ctx.sampleRate * seconds)
    const buffer = this.ctx.createBuffer(1, n, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < n; i++)
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3)
    this.noise = buffer
    return buffer
  }
}
