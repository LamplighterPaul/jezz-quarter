export type Reaction = 'cheer' | 'boo'
export const REACTION_COOLDOWN_MS = 30_000
export class AudienceFeedback {
  private cooldowns = new Map<string, number>()
  private events: { reaction: Reaction; bar: number; at: number }[] = []
  remaining(id: string, now = Date.now()) {
    return Math.max(0, (this.cooldowns.get(id) ?? 0) - now)
  }
  react(id: string, reaction: Reaction, bar: number, now = Date.now()) {
    const retryAfterMs = this.remaining(id, now)
    if (retryAfterMs) return { accepted: false, retryAfterMs }
    this.cooldowns.set(id, now + REACTION_COOLDOWN_MS)
    this.events.push({ reaction, bar, at: now })
    // Memory bounded even when the public room runs for days.
    for (const [key, until] of this.cooldowns)
      if (until <= now) this.cooldowns.delete(key)
    this.events = this.events
      .filter((event) => now - event.at < 120_000)
      .slice(-500)
    return { accepted: true, retryAfterMs: REACTION_COOLDOWN_MS }
  }
  recent(bar: number, now = Date.now()) {
    const events = this.events.filter(
      (event) => bar - event.bar <= 6 && now - event.at < 60_000,
    )
    return {
      cheers: events.filter((event) => event.reaction === 'cheer').length,
      boos: events.filter((event) => event.reaction === 'boo').length,
      passages: events.map(({ reaction, bar: endBar }) => ({
        reaction,
        fromBar: Math.max(0, endBar - 3),
        throughBar: endBar,
      })),
      meaning:
        'Cheers approve the recent passage: develop what worked, do not freeze it. Boos ask for a fresh response to the last few bars. These are audience reactions, not commands or a score to maximize.',
    }
  }
}
