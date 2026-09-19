import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultMix, mixGains } from '../src/audio/mix.ts'

test('local mixer supports mute, multiple solos, levels and reset', () => {
  const mix = defaultMix()
  assert.deepEqual(mixGains(mix), { horn: 1, bass: 1, piano: 1, drums: 1 })
  mix.piano.muted = true
  assert.deepEqual(mixGains(mix), { horn: 1, bass: 1, piano: 0, drums: 1 })
  mix.bass.solo = true
  mix.bass.volume = 35
  assert.deepEqual(mixGains(mix), { horn: 0, bass: 0.35, piano: 0, drums: 0 })
  mix.drums.solo = true
  assert.deepEqual(mixGains(mix), { horn: 0, bass: 0.35, piano: 0, drums: 1 })
  mix.drums.muted = true
  assert.equal(mixGains(mix).drums, 0)
  assert.deepEqual(mixGains(defaultMix()), {
    horn: 1,
    bass: 1,
    piano: 1,
    drums: 1,
  })
})

test('invalid levels cannot produce unsafe channel gains', () => {
  const mix = defaultMix()
  mix.horn.volume = Infinity
  mix.bass.volume = -5
  mix.piano.volume = 200
  mix.drums.volume = NaN
  assert.deepEqual(mixGains(mix), { horn: 0, bass: 0, piano: 1, drums: 0 })
})
