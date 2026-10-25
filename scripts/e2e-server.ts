import type { Readable, Writable } from 'node:stream'
import { spawn, spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline'

const [port = '8788', stateDirectory = '.wrangler/e2e-state'] = process.argv.slice(2)

// The production build served by the Worker, on its own local database so that test scores stay out of the dev one.
// Expected noise: workerd logs every response the browser stops reading when a test moves on, and wrangler reminds
// that cron triggers do not run locally.
const EXPECTED_NOISE = [/disconnected: write\(\)/, /Scheduled Workers are not automatically triggered/]
const ANSI_COLOR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

const migration = spawnSync(
  'bunx',
  ['wrangler', 'd1', 'migrations', 'apply', 'pokebrawl', '--local', '--persist-to', stateDirectory],
  { encoding: 'utf8' },
)
if (migration.status !== 0) {
  process.stderr.write(migration.stdout + migration.stderr)
  process.exit(migration.status ?? 1)
}

const server = spawn(
  'bunx',
  [
    'wrangler',
    'dev',
    '--port',
    port,
    '--ip',
    '127.0.0.1',
    '--persist-to',
    stateDirectory,
    '--show-interactive-dev-session=false',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] },
)

function forwardWithoutExpectedNoise(input: Readable, output: Writable) {
  let isSkippingNoiseBlock = false
  createInterface({ input }).on('line', (line) => {
    const plainLine = line.replace(ANSI_COLOR, '')
    if (EXPECTED_NOISE.some((pattern) => pattern.test(plainLine))) {
      isSkippingNoiseBlock = true
      return
    }
    if (isSkippingNoiseBlock && (plainLine.trim() === '' || /^\s/.test(plainLine))) return
    isSkippingNoiseBlock = false
    output.write(`${line}\n`)
  })
}

forwardWithoutExpectedNoise(server.stdout, process.stdout)
forwardWithoutExpectedNoise(server.stderr, process.stderr)
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => server.kill(signal))
server.on('exit', (code) => process.exit(code ?? 0))
