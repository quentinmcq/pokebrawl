import { dailyChallenge, dayOf, isDay } from '../src/daily'
import { readFriendChallenge } from '../src/friend'
import {
  isPlayerId,
  RANKING_SIZE,
  scoreOfTeam,
  type Ranking,
  type RankingEntry,
  type ScoreSubmission,
} from '../src/leaderboard'
import { HOME_PATHS, LOCALES, localeOfPath, type Locale } from '../src/locale'
import { MESSAGES, TRANSLATED_ATTRIBUTES, type PageKey, type ServerError } from '../src/messages'
import { checkNickname } from '../src/nickname'
import { pokedex } from '../src/pokedex'
import { selectorOfFighters, selectTeam } from '../src/simulation/teams'
import { isTrackedEvent } from '../src/tracking'

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
interface RewrittenElement {
  getAttribute(name: string): string | null
  setAttribute(name: string, value: string): void
  setInnerContent(content: string, options?: { html: boolean }): void
  append(content: string, options?: { html: boolean }): void
}
declare class HTMLRewriter {
  on(selector: string, handlers: { element(element: RewrittenElement): void }): HTMLRewriter
  transform(response: Response): Response
}
interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>
}
interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
  DB: { prepare(query: string): D1PreparedStatement; batch(statements: D1PreparedStatement[]): Promise<unknown> }
  SUBMIT_RATE_LIMITER?: RateLimiter
  EVENT_RATE_LIMITER?: RateLimiter
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
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  })
// Errors carry a code the app words in its language, and the French text older versions of the app show as it is.
const SERVER_ERROR_TEXTS = MESSAGES.fr.serverErrors
const failure = (code: ServerError, status: number) =>
  json({ error: SERVER_ERROR_TEXTS[code], code: { server: code } }, status)

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
  if (day !== dayOf(new Date())) return failure('finished', 409)
  const body = (await request.json().catch(() => null)) as Partial<ScoreSubmission> | null
  if (!body || !isPlayerId(body.playerId)) return failure('invalidRequest', 400)
  const nickname = checkNickname(body.name)
  if (!nickname.ok)
    return json({ error: MESSAGES.fr.nicknameErrors[nickname.error], code: { nickname: nickname.error } }, 422)
  const score = scoreOfTeam(body.team)
  if (!score) return failure('invalidTeam', 422)

  const playerHash = await hashOf(body.playerId)
  const now = Date.now()
  const horde = selectorOfFighters(selectTeam(pokedex, dailyChallenge(day).horde).fighters)
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO daily_scores (day, player_hash, name, points, size, team, horde, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (day, player_hash) DO UPDATE SET
         points = excluded.points, size = excluded.size, team = excluded.team, horde = excluded.horde,
         updated_at = excluded.updated_at
       WHERE excluded.points < daily_scores.points`,
    ).bind(day, playerHash, nickname.nickname, score.points, score.size, body.team, horde, now),
    env.DB.prepare('UPDATE daily_scores SET name = ? WHERE day = ? AND player_hash = ?').bind(
      nickname.nickname,
      day,
      playerHash,
    ),
  ])
  return json(await readRanking(env, day, body.playerId))
}

const isSameOrigin = (request: Request, url: URL) => {
  const origin = request.headers.get('origin')
  return !origin || new URL(origin).host === url.host
}

/** Adds one to today's count of an event; a refused or rate-limited event is dropped without a word. */
async function countEvent(request: Request, env: Env, url: URL) {
  const body = (await request.json().catch(() => null)) as { name?: unknown } | null
  if (!isSameOrigin(request, url) || !isTrackedEvent(body?.name)) return new Response(null, { status: 204 })
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
  if (!((await env.EVENT_RATE_LIMITER?.limit({ key: ip }))?.success ?? true)) return new Response(null, { status: 204 })
  await env.DB.prepare(
    'INSERT INTO event_counts (day, name, count) VALUES (?, ?, 1) ON CONFLICT (day, name) DO UPDATE SET count = count + 1',
  )
    .bind(dayOf(new Date()), body.name)
    .run()
  return new Response(null, { status: 204 })
}

async function handleApi(request: Request, env: Env, url: URL) {
  if (url.pathname === '/api/events' && request.method === 'POST') return countEvent(request, env, url)
  const day = /^\/api\/daily\/([\d-]+)$/.exec(url.pathname)?.[1]
  if (!day || !isDay(day)) return failure('notFound', 404)
  if (request.method === 'GET') return json(await readRanking(env, day, request.headers.get('x-player-id')))
  if (request.method !== 'POST') return failure('methodNotAllowed', 405)

  if (!isSameOrigin(request, url)) return failure('refused', 403)
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
  const allowed = (await env.SUBMIT_RATE_LIMITER?.limit({ key: ip }))?.success ?? true
  if (!allowed) return failure('tooMany', 429)
  return submitScore(env, day, request)
}

/**
 * Messaging apps and search engines read the page without running the app, so the Worker writes into it what they
 * need: its language and texts (the HTML is French, `/en/` gets the English ones), the address of each translation,
 * an absolute image address, and for a friend's challenge, who sends it and the team to beat. Cheap enough for a free
 * Worker.
 */
function homePage(response: Response, url: URL, locale: Locale) {
  const text = MESSAGES[locale]
  const alternates = [...LOCALES, 'x-default' as const]
    .map((code) => {
      const path = HOME_PATHS[code === 'x-default' ? 'fr' : code]
      return `<link rel="alternate" hreflang="${code}" href="${url.origin}${path}" />`
    })
    .join('')
  let rewriter = new HTMLRewriter()
    .on('html', { element: (element) => element.setAttribute('lang', locale) })
    .on('head', {
      element: (element) =>
        element.append(`<link rel="canonical" href="${url.origin}${HOME_PATHS[locale]}" />${alternates}`, {
          html: true,
        }),
    })
    .on('meta[property="og:image"]', {
      element: (element) => element.setAttribute('content', `${url.origin}/og.png`),
    })
  if (locale !== 'fr') {
    rewriter = rewriter.on('[data-i18n]', {
      element: (element) =>
        element.setInnerContent(text.page[element.getAttribute('data-i18n') as PageKey], { html: true }),
    })
    for (const attribute of TRANSLATED_ATTRIBUTES)
      rewriter = rewriter.on(`[data-i18n-${attribute}]`, {
        element: (element) =>
          element.setAttribute(attribute, text.page[element.getAttribute(`data-i18n-${attribute}`) as PageKey]),
      })
  }
  const challenge = readFriendChallenge(url.search, text.aFriend)
  if (!challenge) return rewriter.transform(response)
  const title = text.challengePreviewTitle(challenge.name)
  const description = text.challengePreviewDescription(challenge.size, challenge.points)
  return rewriter
    .on('title', { element: (element) => element.setInnerContent(title) })
    .on('meta[property="og:title"]', { element: (element) => element.setAttribute('content', title) })
    .on('meta[property="og:description"]', { element: (element) => element.setAttribute('content', description) })
    .on('meta[name="description"]', { element: (element) => element.setAttribute('content', description) })
    .transform(response)
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)
    if (url.pathname === '/en') return Response.redirect(`${url.origin}/en/${url.search}`, 301)
    if (Object.values(HOME_PATHS).includes(url.pathname)) {
      const page = await env.ASSETS.fetch(new Request(new URL('/', url), request))
      return homePage(page, url, localeOfPath(url.pathname))
    }
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request)
    return handleApi(request, env, url).catch((error: unknown) => {
      console.error(error)
      return failure('server', 500)
    })
  },
}
