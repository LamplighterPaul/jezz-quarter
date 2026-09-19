import { useEffect, useState } from 'react'

type Phase = 'away' | 'arriving' | 'seated' | 'leaving'
function Guest({ present, number }: { present: boolean; number: number }) {
  const [phase, setPhase] = useState<Phase>('away')
  useEffect(() => {
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    if (reduced) {
      setPhase(present ? 'seated' : 'away')
      return
    }
    if (present) {
      setPhase((previous) => (previous === 'seated' ? previous : 'arriving'))
      const timer = window.setTimeout(() => setPhase('seated'), 2600)
      return () => window.clearTimeout(timer)
    }
    setPhase((previous) => (previous === 'away' ? 'away' : 'leaving'))
    const timer = window.setTimeout(() => setPhase('away'), 2600)
    return () => window.clearTimeout(timer)
  }, [present])
  return (
    <div
      className={`guest guest-${number} guest-${phase}`}
      data-guest={number}
      data-phase={phase}
    >
      <div className="guest-sprite" />
    </div>
  )
}

export function Audience({ visitors }: { visitors: number }) {
  return (
    <div className="audience" aria-hidden="true">
      <Guest number={1} present={visitors >= 2} />
      <Guest number={2} present={visitors >= 3} />
    </div>
  )
}
