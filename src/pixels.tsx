import type { Seat } from '../shared/types.ts'

const P: Record<string, string> = {
  '.': 'transparent',
  k: '#1a1612',
  s: '#c9a36a',
  d: '#5c3d24',
  w: '#efe6d6',
  r: '#c45c3a',
  b: '#3d6b78',
  g: '#6b8f71',
  y: '#e2c56b',
  n: '#2a241c',
}

const SPRITES: Record<Seat, string[]> = {
  piano: [
    '....kkkk....',
    '...kssssk...',
    '...kswwsk...',
    '....sdds....',
    '...rrrrrr...',
    '..r......r..',
    '.r...nn...r.',
    'kk...nn...kk',
    'kk........kk',
    '.k........k.',
    '.k.kkkkkk.k.',
    '..k......k..',
    '..kk....kk..',
    '...k....k...',
    '...kk..kk...',
    '............',
  ],
  bass: [
    '.....kk.....',
    '....kssk....',
    '....swws....',
    '.....dd.....',
    '....bbbb....',
    '....b..b....',
    '...bbnnbb...',
    '...b.nn.b...',
    '..kk....kk..',
    '.k..yyyy..k.',
    'k...y..y...k',
    'k...yyyy...k',
    '.k...yy...k.',
    '..k..yy..k..',
    '...k.yy.k...',
    '....kyyk....',
  ],
  drums: [
    '.....kk.....',
    '....kssk....',
    '....swws....',
    '.....dd.....',
    '....gggg....',
    '...g....g...',
    '..g..nn..g..',
    '..kk.nn.kk..',
    '.k..yyyy..k.',
    'k..yy..yy..k',
    'k.yy....yy.k',
    '.kyy....yyk.',
    '..yy....yy..',
    '...y....y...',
    '...kk..kk...',
    '............',
  ],
  horn: [
    '.....kk.....',
    '....kssk....',
    '....swws....',
    '.....dd.....',
    '....rrrr....',
    '...r....r...',
    '..r..nn..r..',
    '..kk.nn.kk..',
    '.k........k.',
    'k....yyyyyyk',
    'k...yy....y.',
    '.k.yy.......',
    '..kyy.......',
    '...yy.......',
    '...kk.......',
    '............',
  ],
}

export function Sprite({ seat, active, rest }: { seat: Seat; active: boolean; rest: boolean }) {
  const rows = SPRITES[seat]
  return (
    <div className={`sprite${active ? ' on' : ''}${rest ? ' rest' : ''}`} title={seat}>
      {rows.map((row, y) =>
        row.split('').map((c, x) => (
          <i key={`${y}-${x}`} style={{ background: P[c] ?? 'transparent', gridColumn: x + 1, gridRow: y + 1 }} />
        )),
      )}
    </div>
  )
}
