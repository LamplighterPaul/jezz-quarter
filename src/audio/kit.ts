import { midiHz } from '../../shared/theory.ts'

function room(ctx: AudioContext, seconds = 1.6): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(2, n, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < n; i++) {
      const t = i / n
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.4) * (1 - Math.exp(-i / 400))
    }
  }
  return buffer
}

export class Kit {
  readonly ctx: AudioContext
  private readonly dry: GainNode
  private readonly wet: GainNode
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
    const verb = ctx.createConvolver()
    verb.buffer = room(ctx)
    this.dry = ctx.createGain()
    this.dry.gain.value = 0.84
    this.wet = ctx.createGain()
    this.wet.gain.value = 0.22
    this.dry.connect(comp)
    this.wet.connect(verb).connect(comp)
    comp.connect(this.out).connect(ctx.destination)
  }

  piano(midi: number, at: number, hold: number, velocity: number) {
    const ctx = this.ctx
    const f = midiHz(midi)
    const v = Math.max(0.03, Math.min(1, velocity))
    const ring = Math.min(10 * Math.pow(0.5, (midi - 24) / 26) + 0.3, hold + 0.4)
    const end = at + ring + 0.08
    const body = ctx.createGain()
    body.connect(this.dry)
    body.connect(this.wet)
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
      const peak = [1, 0.4, 0.22, 0.12, 0.07, 0.035][i] * v
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + 0.004)
      g.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.05, ring / (1 + 0.6 * i)))
      osc.connect(g).connect(tone)
      osc.start(at)
      osc.stop(end)
    })
    body.gain.setValueAtTime(1, at + Math.max(0.02, hold))
    body.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.05, hold) + 0.35)
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
    g.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.08, hold + 0.12))
    osc.connect(g)
    sub.connect(g)
    g.connect(this.dry)
    osc.start(at); osc.stop(at + hold + 0.2)
    sub.start(at); sub.stop(at + hold + 0.2)
  }

  horn(midi: number, at: number, hold: number, velocity: number) {
    const ctx = this.ctx
    const f = midiHz(midi)
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = f
    const filt = ctx.createBiquadFilter()
    filt.type = 'lowpass'
    filt.frequency.setValueAtTime(600 + 1800 * velocity, at)
    filt.frequency.exponentialRampToValueAtTime(400, at + hold)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(0.22 * velocity, at + 0.03)
    g.gain.setValueAtTime(0.18 * velocity, at + Math.max(0.05, hold - 0.05))
    g.gain.exponentialRampToValueAtTime(0.0001, at + hold + 0.08)
    osc.connect(filt).connect(g).connect(this.dry)
    g.connect(this.wet)
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
      osc.connect(g).connect(this.dry)
      osc.start(at); osc.stop(at + 0.25)
      return
    }
    const n = this.burst(kind === 'ride' ? 0.05 : 0.08)
    const src = ctx.createBufferSource()
    src.buffer = n
    const bp = ctx.createBiquadFilter()
    bp.type = kind === 'snare' ? 'bandpass' : 'highpass'
    bp.frequency.value = kind === 'snare' ? 1800 : kind === 'ride' ? 7000 : 9000
    bp.Q.value = kind === 'snare' ? 0.8 : 0.4
    const g = ctx.createGain()
    g.gain.setValueAtTime((kind === 'ride' ? 0.12 : 0.35) * velocity, at)
    g.gain.exponentialRampToValueAtTime(0.0001, at + (kind === 'ride' ? 0.18 : 0.12))
    src.connect(bp).connect(g).connect(this.dry)
    src.start(at)
  }

  private burst(seconds: number): AudioBuffer {
    if (this.noise && this.noise.duration >= seconds) return this.noise
    const n = Math.floor(this.ctx.sampleRate * seconds)
    const buffer = this.ctx.createBuffer(1, n, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3)
    this.noise = buffer
    return buffer
  }
}
