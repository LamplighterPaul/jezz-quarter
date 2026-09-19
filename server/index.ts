import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { WebSocketServer, type WebSocket } from 'ws'
import { live } from './jev.ts'
import { BPM, Room } from './room.ts'

const app = new Hono()
const PORT = Number(process.env.PORT ?? 8787)
const room = new Room()

app.get('/up', (c) => c.text('ok'))
app.get('/api/health', (c) =>
  c.json({
    ok: true,
    jev: live(),
    bpm: room.bpm,
    visitors: room.visitors,
    playing: room.playing,
    minutesPlayed: room.snapshot().minutesPlayed,
  }),
)
app.get('/api/snapshot', (c) => c.json(room.snapshot()))

// Signed, anonymous browser identity: reconnects and extra tabs share one seat
// and one reaction cooldown. No account and no personal data.
const signingKey = randomBytes(32)
const sign = (id: string) =>
  createHmac('sha256', signingKey).update(id).digest('hex')
const identity = (cookie: string) => {
  const raw = cookie
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('jezz_guest='))
    ?.slice(11)
  if (!raw) return null
  const [id, signature] = raw.split('.')
  if (!id || !signature || signature.length !== 64) return null
  const expected = Buffer.from(sign(id))
  const actual = Buffer.from(signature)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
    ? id
    : null
}
app.get('/api/guest', (c) => {
  let id = identity(c.req.header('cookie') ?? '')
  if (!id) {
    id = randomUUID()
    c.header(
      'Set-Cookie',
      `jezz_guest=${id}.${sign(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${c.req.header('x-forwarded-proto') === 'https' ? '; Secure' : ''}`,
    )
  }
  c.header('Cache-Control', 'no-store')
  return c.json({ ready: true })
})

app.use('/*', serveStatic({ root: './dist' }))
app.get('/*', serveStatic({ path: './dist/index.html' }))

await room.boot()
const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(
    `jezz-quarter on http://localhost:${info.port}  bpm ${BPM}  ${live() ? 'Jev is live' : 'no key: using the random mock'}`,
  )
})

const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 })
server.on('upgrade', (req, socket, head) => {
  const url = req.url ?? ''
  if (url.split('?')[0] !== '/ws') {
    socket.destroy()
    return
  }
  const id = identity(req.headers.cookie ?? '')
  if (!id) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
    socket.destroy()
    return
  }
  const origin = req.headers.origin
  try {
    if (origin && new URL(origin).host !== req.headers.host) {
      socket.destroy()
      return
    }
  } catch {
    socket.destroy()
    return
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, id))
})

wss.on('connection', (ws: WebSocket, id: string) => {
  const client = {
    id,
    send: (data: string) => {
      if (ws.readyState === ws.OPEN) ws.send(data)
    },
  }
  room.join(client)
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString())
      if (
        message.type === 'react' &&
        (message.reaction === 'cheer' || message.reaction === 'boo')
      )
        room.react(client, message.reaction)
    } catch {
      /* ignore malformed client messages */
    }
  })
  ws.on('close', () => room.leave(client))
  ws.on('error', () => room.leave(client))
})

for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, () => {
    server.close()
    for (const ws of wss.clients) ws.close(1001, 'The room is reopening')
    void room.shutdown().finally(() => process.exit(0))
  })
