import { dayOf } from '../src/daily'
import {
  isDay,
  isPlayerId,
  RANKING_SIZE,
  scoreOfTeam,
  type Ranking,
  type RankingEntry,
  type ScoreSubmission,
} from '../src/leaderboard'
import { checkNickname } from '../src/nickname'

// The few Cloudflare types this Worker uses, rather than the whole workers-types package.
interface D1Result<Row> {
  results: Row[]
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<Row>(): Promise<Row | null>
  all<Row>(): Promise<D1Result<Row>>
  run(): Promise<unknown>
}
interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
  DB: { prepare(query: string): D1PreparedStatement; batch(statements: D1PreparedStatement[]): Promise<unknown> }
  SUBMIT_RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> }
}

interface ScoreRow {
  name: string
  points: number
  size: number
  team: string
  updated_at: number
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
const failure = (message: string, status: number) => json({ error: message }, status)

// The player id stays a secret in the browser: only its hash is stored, so a ranking never leaks it.
async function hashOf(playerId: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(playerId))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function rankOf(env: Env, day: string, playerHash: string) {
  const own = await env.DB.prepare('SELECT points, updated_at FROM daily_scores WHERE day = ? AND player_hash = ?')
    .bind(day, playerHash)
    .first<{ points: number; updated_at: number }>()
  if (!own) return null
  const ahead = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM daily_scores WHERE day = ? AND (points < ? OR (points = ? AND updated_at < ?))',
  )
    .bind(day, own.points, own.points, own.updated_at)
    .first<{ count: number }>()
  return { rank: (ahead?.count ?? 0) + 1, points: own.points }
}

async function readRanking(env: Env, day: string, playerId: string | null): Promise<Ranking> {
  const [rows, total] = await Promise.all([
    env.DB.prepare(
      'SELECT name, points, size, team, updated_at FROM daily_scores WHERE day = ? ORDER BY points, updated_at LIMIT ?',
    )
      .bind(day, RANKING_SIZE)
      .all<ScoreRow>(),
    env.DB.prepare('SELECT COUNT(*) AS count FROM daily_scores WHERE day = ?').bind(day).first<{ count: number }>(),
  ])
  const dayIsOver = day < dayOf(new Date())
  const entries = rows.results.map(({ name, points, size, team }, index): RankingEntry => ({
    rank: index + 1,
    name,
    points,
    size,
    ...(dayIsOver ? { team } : {}),
  }))
  const you = isPlayerId(playerId) ? await rankOf(env, day, await hashOf(playerId)) : null
  return { day, total: total?.count ?? 0, entries, you }
}

/**
 * A free Worker cannot afford to replay the battle (up to 30 ms of computing), so it only checks what is cheap: today's
 * challenge, a valid team within budget, and points it computes itself. `bun run verify-daily` replays the day's
 * scores afterwards and removes any team that does not actually win; teams are also shown once the day is over.
 */
async function submitScore(env: Env, day: string, request: Request) {
  if (day !== dayOf(new Date())) return failure('Ce défi est terminé.', 409)
  const body = (await request.json().catch(() => null)) as Partial<ScoreSubmission> | null
  if (!body || !isPlayerId(body.playerId)) return failure('Requête invalide.', 400)
  const nickname = checkNickname(body.name)
  if (!nickname.ok) return failure(nickname.error, 422)
  const score = scoreOfTeam(body.team)
  if (!score) return failure('Équipe invalide.', 422)

  const playerHash = await hashOf(body.playerId)
  const now = Date.now()
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO daily_scores (day, player_hash, name, points, size, team, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (day, player_hash) DO UPDATE SET
         points = excluded.points, size = excluded.size, team = excluded.team, updated_at = excluded.updated_at
       WHERE excluded.points < daily_scores.points`,
    ).bind(day, playerHash, nickname.nickname, score.points, score.size, body.team, now),
    env.DB.prepare('UPDATE daily_scores SET name = ? WHERE day = ? AND player_hash = ?').bind(
      nickname.nickname,
      day,
      playerHash,
    ),
  ])
  return json(await readRanking(env, day, body.playerId))
}

async function handleApi(request: Request, env: Env, url: URL) {
  const day = /^\/api\/daily\/([\d-]+)$/.exec(url.pathname)?.[1]
  if (!day || !isDay(day)) return failure('Introuvable.', 404)
  if (request.method === 'GET') return json(await readRanking(env, day, request.headers.get('x-player-id')))
  if (request.method !== 'POST') return failure('Méthode non permise.', 405)

  const origin = request.headers.get('origin')
  if (origin && new URL(origin).host !== url.host) return failure('Requête refusée.', 403)
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
  const allowed = (await env.SUBMIT_RATE_LIMITER?.limit({ key: ip }))?.success ?? true
  if (!allowed) return failure('Trop d’envois, réessaie dans une minute.', 429)
  return submitScore(env, day, request)
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request)
    return handleApi(request, env, url).catch((error: unknown) => {
      console.error(error)
      return failure('Erreur du serveur.', 500)
    })
  },
}
