import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WebSocket } from 'ws'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

test(
  'room identities, feedback limit, clock migration and pause/resume work over real sockets',
  { timeout: 20_000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'jezz-test-'))
    const stats = join(directory, 'stats.json')
    await writeFile(stats, JSON.stringify({ minutesPlayed: 9999, bars: 12 }))
    const child = spawn(process.execPath, ['server/index.ts'], {
      env: {
        ...process.env,
        PORT: '0',
        TYPESAFE_API_KEY: '',
        STATS_FILE: stats,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const sockets: WebSocket[] = []
    let stderr = ''
    child.stderr.on('data', (b) => (stderr += b))
    try {
      const port = await new Promise<number>((resolve, reject) => {
        child.stdout.on('data', (b) => {
          const match = String(b).match(/localhost:(\d+)/)
          if (match) resolve(Number(match[1]))
        })
        child.on('exit', (code) =>
          reject(new Error(`Server exited ${code}: ${stderr}`)),
        )
      })
      const base = `http://localhost:${port}`
      const health = () => fetch(base + '/api/health').then((r) => r.json())
      const cookie = async () => {
        const response = await fetch(base + '/api/guest')
        return response.headers.get('set-cookie')!.split(';')[0]
      }
      const connect = async (id: string) => {
        const ws = new WebSocket(`ws://localhost:${port}/ws`, {
          headers: { cookie: id, origin: base },
        })
        const messages: any[] = []
        ws.on('message', (data) => messages.push(JSON.parse(String(data))))
        sockets.push(ws)
        await new Promise<void>((resolve, reject) => {
          ws.once('message', () => resolve())
          ws.once('error', reject)
        })
        return { ws, messages }
      }
      const one = await cookie(),
        two = await cookie(),
        three = await cookie()
      const a = await connect(one),
        duplicate = await connect(one)
      const b = await connect(two),
        c = await connect(three)
      assert.equal((await health()).visitors, 3)
      assert.ok(
        (await health()).minutesPlayed < 1,
        'Legacy inflated total must not be inherited',
      )
      await wait(400)
      a.ws.send(JSON.stringify({ type: 'react', reaction: 'cheer' }))
      await wait(50)
      duplicate.ws.send(JSON.stringify({ type: 'react', reaction: 'boo' }))
      await wait(50)
      assert.ok(a.messages.some((m) => m.type === 'reaction' && m.accepted))
      assert.ok(
        duplicate.messages.some(
          (m) => m.type === 'reaction' && !m.accepted && m.retryAfterMs > 29000,
        ),
      )
      b.ws.close()
      c.ws.close()
      duplicate.ws.close()
      await wait(80)
      assert.equal((await health()).visitors, 1)
      a.ws.close()
      await wait(80)
      const paused = await health()
      assert.equal(paused.playing, false)
      await wait(100)
      assert.equal((await health()).minutesPlayed, paused.minutesPlayed)
      const rejoined = await connect(one)
      assert.ok(
        rejoined.messages.some((m) => m.type === 'hello' && m.retryAfterMs > 0),
      )
      await wait(100)
      const resumed = await health()
      assert.ok(
        resumed.minutesPlayed - paused.minutesPlayed < 0.004,
        'Resume must not re-add the whole previous session',
      )
      assert.ok(resumed.minutesPlayed > paused.minutesPlayed)
      rejoined.ws.close()
      await wait(100)
      const stored = JSON.parse(await readFile(stats, 'utf8'))
      assert.equal(stored.version, 2)
      assert.equal(stored.legacyStats.minutesPlayed, 9999)
      assert.ok(stored.minutesPlayed < 1)
      assert.equal(stderr, '')
    } finally {
      for (const ws of sockets) ws.terminate()
      child.kill('SIGTERM')
      await new Promise((resolve) => child.once('exit', resolve))
      await rm(directory, { recursive: true, force: true })
    }
  },
)
