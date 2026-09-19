/** Performance time advances once per room, regardless of listener count. */
export class RoomClock {
  private frozenMs = 0
  private origin = 0
  playing = false

  constructor(privateBaseMinutes = 0, now: () => number = Date.now) {
    this.baseMinutes = privateBaseMinutes
    this.now = now
  }
  private readonly baseMinutes: number
  private readonly now: () => number

  get elapsedMs() {
    return this.frozenMs + (this.playing ? this.now() - this.origin : 0)
  }
  get minutesPlayed() {
    return this.baseMinutes + this.elapsedMs / 60_000
  }

  resume() {
    if (this.playing) return
    this.origin = this.now()
    this.playing = true
  }
  pause() {
    if (!this.playing) return
    this.frozenMs = this.elapsedMs
    this.playing = false
  }
}
