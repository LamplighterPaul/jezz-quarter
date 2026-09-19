import { useMemo, useState } from 'react'
import type { Bar, Decision, Seat, Snapshot } from '../shared/types.ts'
import { Player } from './audio/player.ts'
import { Sprite } from './pixels.tsx'

const SEATS: Seat[] = ['piano', 'bass', 'drums', 'horn']
const NAMES: Record<Seat, string> = { piano: 'piano', bass: 'bass', drums: 'drums', horn: 'horn' }

export function App() {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [bar, setBar] = useState<Bar | null>(null)
  const [armed, setArmed] = useState(false)
  const [error, setError] = useState('')

  const player = useMemo(() => new Player({
    onSnapshot: setSnap,
    onBar: setBar,
    onKeys: () => {},
    onError: setError,
  }), [])

  async function enter() {
    await player.arm()
    player.connect()
    setArmed(true)
  }

  const playing = snap?.playing ?? false
  const visitors = snap?.visitors ?? 0
  const minutes = snap?.minutesPlayed ?? 0
  const rest = (seat: Seat) => bar?.parts[seat].rest ?? true
  const active = (seat: Seat) => playing && !rest(seat)

  return (
    <div>
      <header>
        <h1>Jezz Quarter</h1>
        <p className="lede">
          Four Jevs. Four harnesses. No chart, no prompt, no leader.
          They invent the harmony as they go, hearing only what just happened.
          They play when someone is in the room. They pause when it empties.
          Everyone in the room hears the same night.
        </p>
        <div className="stats">
          <span>{visitors} {visitors === 1 ? 'visitor' : 'visitors'}</span>
          <span>{minutes.toFixed(1)} minutes played</span>
          <span>{snap?.bpm ?? '—'} bpm</span>
          <span>{playing ? 'live' : 'waiting'}</span>
          {snap?.mock && <span className="warn">mock — no key</span>}
        </div>
      </header>

      {!armed && (
        <button className="enter" onClick={() => void enter()}>come in</button>
      )}

      {error && <p className="error">{error}</p>}

      <div className="stage">
        {SEATS.map(seat => (
          <div key={seat} className="player">
            <Sprite seat={seat} active={active(seat)} rest={rest(seat)} />
            <div className="name">{NAMES[seat]}</div>
            <div className="doing">{bar ? bar.parts[seat].heard : '—'}</div>
          </div>
        ))}
      </div>

      {bar && (
        <div className="strip">
          {SEATS.map(seat => (
            <div key={seat} className="seat">
              <h2>{NAMES[seat]}</h2>
              {bar.decisions.filter(d => d.seat === seat).map(d => <Line key={d.id} d={d} />)}
            </div>
          ))}
        </div>
      )}

      <p className="foot">by 4 Jevs · {bar ? `bar ${bar.index + 1}` : 'no bar yet'}</p>
    </div>
  )
}

function Line({ d }: { d: Decision }) {
  const p = d.options.find(o => o.key === d.picked)?.p
  return (
    <div className="line">
      <span className="lab">{d.label}</span>
      <span className="pick">{d.picked.replace(/_/g, ' ')}</span>
      {p !== undefined && (
        <span className="pct" title={`${(p * 100).toFixed(1)}%`}>
          <span className="track"><span className="fill" style={{ width: `${Math.max(2, p * 100)}%` }} /></span>
        </span>
      )}
    </div>
  )
}
