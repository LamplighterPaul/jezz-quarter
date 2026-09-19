import { useState } from 'react'
import type { Bar, Seat } from '../shared/types.ts'
import {
  defaultMix,
  mixGains,
  MIX_SEATS,
  type Mix,
  type ChannelMix,
} from './audio/mix.ts'

const names: Record<Seat, string> = {
  horn: 'Horn',
  bass: 'Bass',
  piano: 'Piano',
  drums: 'Drums',
}

type Props = {
  bar: Bar | null
  muted: boolean
  busy: boolean
  onSound(): void
  onMix(mix: Mix): void
}

export function DebugMixer({ bar, muted, busy, onSound, onMix }: Props) {
  const [mix, setMix] = useState(defaultMix)
  const gains = mixGains(mix)
  function change(seat: Seat, patch: Partial<ChannelMix>) {
    const next = { ...mix, [seat]: { ...mix[seat], ...patch } }
    setMix(next)
    onMix(next)
  }
  function reset() {
    const next = defaultMix()
    setMix(next)
    onMix(next)
  }
  return (
    <section className="debug-panel" aria-label="Local instrument mixer">
      <div className="debug-heading">
        <div>
          <span className="panel-label">BACKSTAGE / DEBUG</span>
          <h2>Your ears. Your mix.</h2>
        </div>
        <a href={window.location.pathname} className="pixel-button">
          Exit debug
        </a>
      </div>
      <p className="debug-intro">
        Mute, solo or turn down a player. The quartet keeps going, and nobody
        else’s sound changes.
      </p>
      <div className="debug-transport">
        <button
          onClick={onSound}
          disabled={busy}
          aria-label={muted ? 'Enable debug audio' : 'Mute debug audio'}
        >
          {muted ? 'Listen to this mix' : 'Mute all sound'}
        </button>
        <button onClick={reset}>Reset mix</button>
        <span role="status">
          {muted ? 'MASTER SOUND OFF' : 'MASTER SOUND ON'} ·{' '}
          {bar
            ? `BAR ${bar.index + 1} / ${bar.bpm} BPM`
            : 'WAITING FOR THE BAND'}
        </span>
      </div>
      <div className="mixer-channels">
        {MIX_SEATS.map((seat) => (
          <article
            className={`mixer-channel${gains[seat] === 0 ? ' channel-muted' : ''}`}
            key={seat}
          >
            <div className="channel-title">
              <h3>{names[seat]}</h3>
              <span>
                {gains[seat] === 0
                  ? 'MUTED'
                  : mix[seat].solo
                    ? 'SOLO'
                    : 'IN MIX'}
              </span>
            </div>
            <div className="channel-buttons">
              <button
                aria-label={`Mute ${names[seat]}`}
                aria-pressed={mix[seat].muted}
                onClick={() => change(seat, { muted: !mix[seat].muted })}
              >
                Mute
              </button>
              <button
                aria-label={`Solo ${names[seat]}`}
                aria-pressed={mix[seat].solo}
                onClick={() =>
                  change(seat, { solo: !mix[seat].solo, muted: false })
                }
              >
                Solo
              </button>
            </div>
            <label className="fader-label" htmlFor={`volume-${seat}`}>
              Level <output>{mix[seat].volume}%</output>
            </label>
            <input
              id={`volume-${seat}`}
              aria-label={`${names[seat]} volume`}
              type="range"
              min="0"
              max="100"
              step="1"
              value={mix[seat].volume}
              onChange={(event) =>
                change(seat, { volume: Number(event.target.value) })
              }
            />
            <p className="channel-activity">
              {bar
                ? `${bar.notes.filter((note) => note.seat === seat).length} notes · ${bar.parts[seat].rest ? 'resting this bar' : 'playing this bar'}`
                : 'Waiting for the first bar'}
            </p>
            <details>
              <summary>Jev decisions</summary>
              {bar && (seat === 'bass' || seat === 'horn') && (
                <p className="model-answer">
                  {bar.parts[seat].answeredCalls}/{bar.parts[seat].calls} calls
                  answered · {bar.parts[seat].policy} ·{' '}
                  {bar.parts[seat].planningMs} ms · {bar.parts[seat].planning}
                  {bar.parts[seat].planning !== 'complete' &&
                    ' — unplanned time left silent; no replacement notes'}
                </p>
              )}
              <div
                className="debug-decisions"
                tabIndex={0}
                aria-label={`${names[seat]} decision history`}
              >
                {bar?.decisions
                  .filter((decision) => decision.seat === seat)
                  .map((decision) => (
                    <div key={decision.id}>
                      <small className="decision-type">
                        {decision.type?.toUpperCase() ?? 'DECISION'}
                        {decision.confidence != null
                          ? ` · confidence ${Math.round(decision.confidence * 100)}%`
                          : ''}
                      </small>
                      <strong>
                        {decision.label}: {decision.picked.replaceAll('_', ' ')}
                      </strong>
                      {decision.modelPicked && (
                        <p className="model-answer">
                          Jev’s top choice:{' '}
                          {decision.modelPicked.replaceAll('_', ' ')}
                        </p>
                      )}
                      {decision.score != null && (
                        <p className="model-answer">
                          Jev’s score: {decision.score.toFixed(2)}
                        </p>
                      )}
                      <div>
                        {decision.options.map((option) => (
                          <span key={option.key}>
                            {option.key.replaceAll('_', ' ')}{' '}
                            <b>{Math.round(option.p * 100)}%</b>
                          </span>
                        ))}
                      </div>
                    </div>
                  )) ?? <p>No decisions yet.</p>}
              </div>
            </details>
          </article>
        ))}
      </div>
      <details className="loop-explainer">
        <summary>How this set is being made</summary>
        <p>
          Bass and horn each build a private phrase, choosing one note or rest
          at a time: pitch, spacing, release and touch. Pitch and spacing use
          Jev’s original probabilities (or top choices in direct mode); Noul
          uses a 50% threshold, and Score sets accent. Only already-sounded
          events enter their listening state. Piano and drums still choose bar
          gestures; the drummer sets BPM. No player sees another player’s future
          notes.
        </p>
        <p>
          These controls change only the audio mix in this browser. They do not
          change Jev’s choices, its history, or the shared performance.
        </p>
        <pre>
          {bar
            ? JSON.stringify(
                {
                  model: bar.stats.model,
                  questions: bar.stats.questions,
                  inputTokens: bar.stats.inputTokens,
                  summedCallMs: bar.stats.ms,
                  wallMs: bar.stats.wallMs,
                  bar: bar.index + 1,
                  bpm: bar.bpm,
                },
                null,
                2,
              )
            : 'Waiting for a bar.'}
        </pre>
      </details>
    </section>
  )
}
