import { useEffect, useRef, useState } from 'react'
import type { Bar, Seat, Snapshot } from '../shared/types.ts'
import { Player } from './audio/player.ts'
import { Stage, type PerformanceState } from './Stage.tsx'
import { DebugMixer } from './DebugMixer.tsx'

const SEATS: Seat[] = ['horn', 'bass', 'piano', 'drums']
const NAMES: Record<Seat, string> = {
  piano: 'Piano',
  bass: 'Bass',
  drums: 'Drums',
  horn: 'Horn',
}
const WAITING: Record<Seat, string> = {
  piano: 'Finding a voicing',
  bass: 'Feeling the pulse',
  drums: 'Settling into time',
  horn: 'Listening for a way in',
}

function Speaker({ muted }: { muted: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="19"
      height="19"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      <path d="M11 5 6 9H3v6h3l5 4z" />
      {muted ? (
        <path d="m16 9 6 6m0-6-6 6" />
      ) : (
        <>
          <path d="M15 8a6 6 0 0 1 0 8" />
          <path d="M18 5a10 10 0 0 1 0 14" />
        </>
      )}
    </svg>
  )
}

export function App() {
  const debug = new URLSearchParams(window.location.search).has('debug')
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [bar, setBar] = useState<Bar | null>(null)
  const [muted, setMuted] = useState(true)
  const [soundBusy, setSoundBusy] = useState(false)
  const [error, setError] = useState('')
  const [reactionUntil, setReactionUntil] = useState(0)
  const [reactionPending, setReactionPending] = useState(false)
  const [reactionNotice, setReactionNotice] = useState('')
  const [audienceReaction, setAudienceReaction] = useState<{
    kind: string
    at: number
  } | null>(null)
  const [status, setStatus] = useState<
    'connecting' | 'connected' | 'reconnecting'
  >('connecting')
  const [now, setNow] = useState(Date.now())
  const snapshotAt = useRef(Date.now())
  const player = useRef<Player | null>(null)
  const meters = useRef<Partial<Record<Seat, HTMLSpanElement | null>>>({})
  const performanceState = useRef<PerformanceState>({
    hits: {
      horn: -Infinity,
      bass: -Infinity,
      piano: -Infinity,
      drums: -Infinity,
    },
    active: { horn: false, bass: false, piano: false, drums: false },
    bpm: 88,
  })

  useEffect(() => {
    const instance = new Player({
      onSnapshot: (value) => {
        snapshotAt.current = Date.now()
        setNow(Date.now())
        setSnap(value)
        performanceState.current.bpm = value.bpm
        if (!value.playing)
          for (const seat of SEATS)
            performanceState.current.active[seat] = false
      },
      onBar: (value) => {
        setBar(value)
        performanceState.current.bpm = value.bpm
        for (const seat of SEATS)
          performanceState.current.active[seat] = !value.parts[seat].rest
      },
      onPulse: (seat) => {
        performanceState.current.hits[seat] = performance.now()
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          meters.current[seat]?.animate(
            [
              { opacity: 1, transform: 'scaleY(1)' },
              { opacity: 0.25, transform: 'scaleY(.35)' },
            ],
            { duration: 340, fill: 'forwards' },
          )
        }
      },
      onStatus: (value) => {
        setStatus(value)
        if (value !== 'connected') setReactionPending(false)
        if (value !== 'connected')
          for (const seat of SEATS)
            performanceState.current.active[seat] = false
      },
      onError: setError,
      onReaction: (accepted, retryAfterMs, reaction, message) => {
        setReactionPending(false)
        setNow(Date.now())
        setReactionUntil(Date.now() + retryAfterMs)
        setReactionNotice(
          message ??
            (accepted
              ? reaction === 'cheer'
                ? 'The band heard your cheer.'
                : 'The band heard you. A new direction?'
              : retryAfterMs
                ? 'Let that one sink in.'
                : ''),
        )
      },
      onAudience: (reaction) =>
        setAudienceReaction({ kind: reaction, at: Date.now() }),
    })
    player.current = instance
    void instance.connect()
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      instance.dispose()
      player.current = null
      window.clearInterval(tick)
    }
  }, [])

  async function toggleSound() {
    if (!player.current || soundBusy) return
    setSoundBusy(true)
    try {
      await player.current.setMuted(!muted)
      setMuted(!muted)
    } catch {
      setError('Your browser couldn’t start audio. Tap sound again to retry.')
    } finally {
      setSoundBusy(false)
    }
  }

  function react(reaction: 'cheer' | 'boo') {
    if (reactionPending || reactionUntil > Date.now()) return
    if (player.current?.react(reaction)) {
      setReactionPending(true)
      setReactionNotice('')
    }
  }
  const cooldown = Math.max(0, Math.ceil((reactionUntil - now) / 1000))
  const connected = status === 'connected'
  const playing = connected && !!snap?.playing && !error
  const minutes =
    (snap?.minutesPlayed ?? 0) +
    (playing ? Math.max(0, now - snapshotAt.current) / 60000 : 0)
  const roomStatus = error
    ? 'A little intermission'
    : status === 'reconnecting'
      ? 'Finding the room again'
      : !connected
        ? 'Opening the doors'
        : playing
          ? 'Live in the room'
          : 'The band is warming up'

  return (
    <main>
      <section className="club" aria-label="The live quartet">
        <Stage performance={performanceState} visitors={snap?.visitors ?? 1} />
        {audienceReaction && now - audienceReaction.at < 2300 && (
          <span
            key={audienceReaction.at}
            className="audience-reaction"
            aria-hidden="true"
          >
            {audienceReaction.kind === 'cheer' ? 'Yeah!' : 'Boo…'}
          </span>
        )}
        <div className="room-label">
          <span className={`live-dot${playing ? ' is-live' : ''}`} />
          <span>{roomStatus}</span>
        </div>
        <button
          className="sound-toggle"
          onClick={() => void toggleSound()}
          disabled={soundBusy}
          aria-label={muted ? 'Unmute sound' : 'Mute sound'}
          aria-pressed={!muted}
          title="Sound is just for you. The quartet keeps playing."
        >
          <Speaker muted={muted} />
          <span>
            {soundBusy ? 'One moment' : muted ? 'Sound off' : 'Sound on'}
          </span>
        </button>
        {muted && (
          <p className="sound-hint">
            Stay a while.{' '}
            <button onClick={() => void toggleSound()} disabled={soundBusy}>
              Turn the sound on.
            </button>
          </p>
        )}
        <div className="stage-caption">
          <span>THE QUARTET</span>
          <span>
            {bar
              ? `${bar.bpm} BPM · DRUMMER’S TIME`
              : snap
                ? `${snap.bpm} BPM`
                : 'ONE SHARED NIGHT'}
          </span>
        </div>
      </section>

      <div className="game-console">
        <section className="band" aria-label="What the musicians are doing">
          {SEATS.map((seat, index) => {
            const part = bar?.parts[seat]
            const resting = !playing || !part || part.rest
            const decisions =
              bar?.decisions
                .filter((d) => d.seat === seat)
                .filter(
                  (d) =>
                    !['rest', 'wander', 'fill', 'tempo_change'].includes(d.id),
                )
                .slice(0, 4) ?? []
            return (
              <article
                className={`musician musician-${seat}${resting ? ' is-resting' : ''}`}
                key={seat}
              >
                <div className="musician-heading">
                  <span className="portrait" aria-hidden="true">
                    <span>0{index + 1}</span>
                  </span>
                  <h2>{NAMES[seat]}</h2>
                  <span
                    className="note-meter"
                    ref={(node) => {
                      meters.current[seat] = node
                    }}
                    aria-hidden="true"
                  >
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
                <p className="heard">
                  {!connected
                    ? 'Listening for the room…'
                    : part
                      ? part.rest
                        ? 'Leaving a little space.'
                        : part.heard
                      : WAITING[seat] + '…'}
                </p>
                <div className="decisions">
                  {decisions.map((d) => (
                    <div key={d.id}>
                      <span>{d.label}</span>
                      <span>{d.picked.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
                <span className="playing-state">
                  <span />
                  {!bar
                    ? 'Taking their place'
                    : resting
                      ? 'Listening'
                      : 'Playing'}
                </span>
              </article>
            )
          })}
        </section>
        <div className="audience-controls">
          <span className="audience-caption">What’ll it be?</span>
          <div className="reaction-buttons">
            <button onClick={() => void toggleSound()} disabled={soundBusy}>
              {muted ? 'Listen' : 'Mute'}
            </button>
            <a href="#about" className="pixel-button">
              Look at
            </a>
            <button
              onClick={() => react('cheer')}
              disabled={!playing || !bar || cooldown > 0 || reactionPending}
              title="Approve the last few bars"
            >
              Cheer
            </button>
            <button
              onClick={() => react('boo')}
              disabled={!playing || !bar || cooldown > 0 || reactionPending}
              title="Ask for a fresh direction"
            >
              Boo
            </button>
          </div>
          <span className="reaction-notice" role="status">
            {reactionPending
              ? 'Sending…'
              : cooldown
                ? `${reactionNotice} Again in ${cooldown}s.`
                : reactionNotice || 'One reaction every 30 seconds.'}
          </span>
        </div>
      </div>
      {debug && (
        <DebugMixer
          bar={bar}
          muted={muted}
          busy={soundBusy}
          onSound={() => void toggleSound()}
          onMix={(mix) => player.current?.setMix(mix)}
        />
      )}
      {error && (
        <p className="room-error" role="status">
          {error}
        </p>
      )}
      {snap?.mock && (
        <p className="room-error" role="status">
          Rehearsal mode — random decisions, not live Jev.
        </p>
      )}

      <footer id="about">
        <div className="about">
          <span className="panel-label">ABOUT THIS ROOM</span>
          <h1>
            Jezz Quarter<span>Four minds. One room.</span>
          </h1>
          <p>
            Four{' '}
            <a href="https://typesafe.ai" target="_blank" rel="noreferrer">
              Jevs
            </a>
            , on piano, bass, drums and horn. No fixed chart. Four independent
            minds. Each listens to what the others just played and decides what
            comes next. The drummer sets the pace. Everyone here hears the same
            night.
          </p>
          <p className="small-print">
            They play while someone’s here. Muting only turns off your sound.
          </p>
        </div>
        <div className="room-details">
          <p>
            <span className="footer-dot" />
            {snap
              ? `${snap.visitors} ${snap.visitors === 1 ? 'person' : 'people'} in the room`
              : 'Connecting to the room'}
          </p>
          <p
            title={
              snap?.countingSince
                ? `Measured room time since ${new Date(snap.countingSince).toLocaleString()}; each minute counts once, regardless of audience size.`
                : 'Time the room has been playing, counted once.'
            }
          >
            <strong>{snap ? minutes.toFixed(1) : '—'}</strong> minutes of music
          </p>
          <p className="footer-links">
            <a
              href="https://github.com/LamplighterPaul/jezz-quarter"
              target="_blank"
              rel="noreferrer"
            >
              Open source <span aria-hidden="true">↗</span>
            </a>
            <span>{bar ? `BAR ${bar.index + 1}` : 'SET ONE'}</span>
          </p>
        </div>
      </footer>
    </main>
  )
}
