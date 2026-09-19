import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { WebSocketServer, type WebSocket } from 'ws'
import { live } from './jev.ts'
import { BPM, Room } from './room.ts'

const app = new Hono()
const PORT = Number(process.env.PORT ?? 8787)
const room = new Room()

app.get('/up', c => c.text('ok'))
app.get('/api/health', c => c.json({
  ok: true,
  jev: live(),
  bpm: BPM,
  visitors: room.visitors,
  playing: room.playing,
  minutesPlayed: room.snapshot().minutesPlayed,
}))
app.get('/api/snapshot', c => c.json(room.snapshot()))

app.use('/*', serveStatic({ root: './dist' }))
app.get('/*', serveStatic({ path: './dist/index.html' }))

const server = serve({ fetch: app.fetch, port: PORT }, async info => {
  await room.boot()
  console.log(`jezz-quarter on http://localhost:${info.port}  bpm ${BPM}  ${live() ? 'Jev is live' : 'no key: using the random mock'}`)
})

const wss = new WebSocketServer({ noServer: true })
server.on('upgrade', (req, socket, head) => {
  const url = req.url ?? ''
  if (!url.startsWith('/ws')) { socket.destroy(); return }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req))
})

wss.on('connection', (ws: WebSocket) => {
  const client = { send: (data: string) => { if (ws.readyState === ws.OPEN) ws.send(data) } }
  room.join(client)
  ws.on('close', () => room.leave(client))
  ws.on('error', () => room.leave(client))
})
