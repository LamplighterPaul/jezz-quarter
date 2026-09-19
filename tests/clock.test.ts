import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RoomClock } from '../server/clock.ts'

test('counts each playing interval once across repeated pauses and resumes', () => {
  let now = 0
  const clock = new RoomClock(0, () => now)
  clock.resume()
  now = 60_000
  assert.equal(clock.minutesPlayed, 1)
  clock.pause()
  now = 120_000
  assert.equal(clock.minutesPlayed, 1)
  clock.resume()
  assert.equal(clock.minutesPlayed, 1)
  now = 180_000
  assert.equal(clock.minutesPlayed, 2)
  clock.pause()
  clock.pause()
  assert.equal(clock.minutesPlayed, 2)
  clock.resume()
  clock.resume()
  now = 210_000
  assert.equal(clock.minutesPlayed, 2.5)
})

test('restored total is independent of the new session playback timeline', () => {
  let now = 0
  const clock = new RoomClock(12.5, () => now)
  assert.equal(clock.elapsedMs, 0)
  clock.resume()
  now = 30_000
  clock.pause()
  assert.equal(clock.minutesPlayed, 13)
  assert.equal(clock.elapsedMs, 30_000)
  const restored = new RoomClock(clock.minutesPlayed, () => now)
  assert.equal(restored.minutesPlayed, 13)
  assert.equal(restored.elapsedMs, 0)
})
