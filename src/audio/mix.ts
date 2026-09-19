import type { Seat } from '../../shared/types.ts'

export const MIX_SEATS: Seat[] = ['horn', 'bass', 'piano', 'drums']
export type ChannelMix = { muted: boolean; solo: boolean; volume: number }
export type Mix = Record<Seat, ChannelMix>

export function defaultMix(): Mix {
  return Object.fromEntries(
    MIX_SEATS.map((seat) => [seat, { muted: false, solo: false, volume: 100 }]),
  ) as Mix
}

/** Local listening controls never change the shared score or Jev's evidence. */
export function mixGains(mix: Mix): Record<Seat, number> {
  const hasSolo = MIX_SEATS.some((seat) => mix[seat].solo)
  return Object.fromEntries(
    MIX_SEATS.map((seat) => {
      const channel = mix[seat]
      const volume = Number.isFinite(channel.volume)
        ? Math.max(0, Math.min(100, channel.volume)) / 100
        : 0
      return [seat, channel.muted || (hasSolo && !channel.solo) ? 0 : volume]
    }),
  ) as Record<Seat, number>
}
