/**
 * Render-review setup hook for Coin Collector Companion (read by the AI Orchestrator's
 * render-capture.mjs; see .claude/verify.json "render").
 *
 * What it starts (start(), once per side, before the dev server):
 *   - A throwaway Postgres 16 container (`docker run --rm`, unique name, label
 *     orchestrator-render=ccc, bound to 127.0.0.1 on a free port). Never the Neon database:
 *     DATABASE_URL is always this container, and the worktree has no apps/api/.env.
 *   - It returns env for the "render" launch configuration, whose command runs
 *     dev-stack.sh (next to this file) in the worktree: shared build, prisma generate,
 *     prisma migrate deploy, api build, the API on CCC_RENDER_API_PORT (in the dev server's
 *     process group, so it dies with it), then `next dev` on $PORT.
 *   - stop() removes the container. Nothing else outlives the capture.
 *
 * How it signs in:
 *   The web app keeps its JWT access token in localStorage ("ccc-auth-token") and RequireAuth
 *   only checks that it is there. seed() registers two test users through the real API
 *   (POST /auth/register, /auth/login; throwaway addresses, fixed test password), then writes
 *   the access token into localStorage before the target route is opened. Tokens are cached
 *   per side and refreshed after 10 minutes (they expire after 15; login is throttled 5/min).
 *
 * Data (inserted once per side with psql inside the container, after migrations):
 *   - 30 approved USA "Lincoln Wheat Cent" coins: 1941-1945 and 1946-1950, mint marks
 *     none/D/S, no images (so nothing loads from Wikimedia).
 *   - 2 canonical sets: "Lincoln Wheat Cents 1941-1945" and "... 1946-1950" (15 coins each).
 *   - Owner (render-owner@example.com):
 *       OWNER_SET     "Wheat Cents 1941-1945", 15 coins, 8 owned (1945 none owned), no min grade
 *       MIN_GRADE_SET "Wheat Cents 1946-1950", 15 coins, min grade VF, 6 owned:
 *                     F, VG and ungraded below VF (to upgrade), XF, VF, AU meeting it
 *       EMPTY_SET     "Empty set", no coins
 *   - Visitor (render-visitor@example.com): owns 3 of OWNER_SET's coins, no sets.
 *
 * The "render-set" alias: render targets open /sets/render-set, but the API validates set
 * ids as UUIDs. seed() installs a page.route on the API origin that rewrites "/render-set"
 * in request URLs to the fixture's real set UUID and that UUID back to "render-set" in GET
 * response bodies, so the page sees one set with id "render-set" (ownership checks included).
 *
 * Fixtures (render.fixtures in verify.json describes each):
 *   owner-set            owner, alias -> OWNER_SET
 *   owner-set-min-grade  owner, alias -> MIN_GRADE_SET
 *   owner-set-empty      owner, alias -> EMPTY_SET
 *   visitor-set          visitor, alias -> OWNER_SET (someone else's public set)
 *   set-load-error       owner, alias -> OWNER_SET, GET /sets/render-set/gaps answered with 500
 *   new-set-sources      owner; the canonical sets above and every user set exist
 *   signed-out           nobody signed in (no token, no cookies); same data, no alias
 *
 * Adding a fixture: add rows to buildSql() if it needs new data (fixed UUIDs, ON CONFLICT DO
 * NOTHING), add an entry to FIXTURES, and describe it in verify.json's render.fixtures.
 */

import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const TOKEN_KEY = 'ccc-auth-token'
const ALIAS = 'render-set'
const PASSWORD = 'render-test-password-1'
const USERS = {
  owner: 'render-owner@example.com',
  visitor: 'render-visitor@example.com',
}
const PG = { user: 'render', password: 'render', db: 'ccc_render' }
const FIXED_TS = '2026-10-01 12:00:00'

// ── fixed ids (valid v4 UUIDs; the API's ParseUUIDPipe checks the format) ──────────────
const uuid = (group, n) => `7e57${group}-0000-4000-8000-${n.toString(16).padStart(12, '0')}`
const OWNER_SET = uuid('5e70', 1)
const MIN_GRADE_SET = uuid('5e70', 2)
const EMPTY_SET = uuid('5e70', 3)
const CANON_EARLY = uuid('ca70', 1)
const CANON_LATE = uuid('ca70', 2)

const FIXTURES = {
  'owner-set': { user: 'owner', setId: OWNER_SET },
  'owner-set-min-grade': { user: 'owner', setId: MIN_GRADE_SET },
  'owner-set-empty': { user: 'owner', setId: EMPTY_SET },
  'visitor-set': { user: 'visitor', setId: OWNER_SET },
  'set-load-error': { user: 'owner', setId: OWNER_SET, failGaps: true },
  'new-set-sources': { user: 'owner', setId: OWNER_SET },
  'signed-out': { user: null },
}

// ── module state (one module instance per side) ─────────────────────────────────────────
const state = { container: null, apiBase: null, dataReady: null, tokens: {} }

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer()
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => resolve(port))
    })
    s.on('error', reject)
  })
}

function docker(args, opts = {}) {
  const r = spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...opts })
  return { code: r.status, out: ((r.stdout || '') + (r.stderr || '')).trim() }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function start() {
  if (docker(['info', '--format', '{{.ServerVersion}}']).code !== 0) {
    throw new Error('render setup needs Docker running (throwaway Postgres for the API)')
  }
  const pgPort = await freePort()
  const apiPort = await freePort()
  const name = `ccc-render-${process.pid}-${crypto.randomBytes(4).toString('hex')}`
  const run = docker([
    'run', '-d', '--rm', '--name', name, '--label', 'orchestrator-render=ccc',
    '-e', `POSTGRES_USER=${PG.user}`, '-e', `POSTGRES_PASSWORD=${PG.password}`, '-e', `POSTGRES_DB=${PG.db}`,
    '-p', `127.0.0.1:${pgPort}:5432`, 'postgres:16-alpine',
  ], { timeout: 300000 })
  if (run.code !== 0) throw new Error(`could not start Postgres container: ${run.out.slice(-500)}`)
  state.container = name
  const stop = async () => {
    docker(['rm', '-f', name])
    state.container = null
  }

  // TCP readiness: the image's init phase only listens on the unix socket, so a TCP
  // answer means the final server is up.
  const deadline = Date.now() + 90000
  let ready = false
  while (Date.now() < deadline) {
    if (docker(['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', PG.user, '-d', PG.db]).code === 0) {
      ready = true
      break
    }
    await sleep(1000)
  }
  if (!ready) {
    await stop()
    throw new Error('throwaway Postgres did not become ready within 90s')
  }

  state.apiBase = `http://localhost:${apiPort}/api/v1`
  return {
    env: {
      DATABASE_URL: `postgresql://${PG.user}:${PG.password}@127.0.0.1:${pgPort}/${PG.db}`,
      JWT_SECRET: 'render-secret-not-for-prod',
      NEXT_PUBLIC_API_URL: state.apiBase,
      CCC_RENDER_API_PORT: String(apiPort),
      CCC_RENDER_DEV_STACK: path.join(HERE, 'dev-stack.sh'),
      TRUST_PROXY_HOPS: '0',
      RESEND_API_KEY: '',
      EMAIL_LOG_RESET_LINKS: '',
      NEXT_TELEMETRY_DISABLED: '1',
    },
    cookies: [],
    stop,
  }
}

// ── data ────────────────────────────────────────────────────────────────────────────────

const MINTS = ['', 'D', 'S']
const q = (s) => (s === null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`)

function coinsFor(fromYear, toYear, startN) {
  const out = []
  let n = startN
  for (let year = fromYear; year <= toYear; year++) {
    for (const mint of MINTS) out.push({ id: uuid('c011', n++), year, mint })
  }
  return out
}

const EARLY = coinsFor(1941, 1945, 1) // 15 coins, OWNER_SET
const LATE = coinsFor(1946, 1950, 101) // 15 coins, MIN_GRADE_SET
const pick = (list, year, mint) => list.find((c) => c.year === year && c.mint === mint).id

function buildSql() {
  const owner = `(SELECT id FROM "User" WHERE email = ${q(USERS.owner)})`
  const visitor = `(SELECT id FROM "User" WHERE email = ${q(USERS.visitor)})`
  const lines = ['BEGIN;']

  for (const c of [...EARLY, ...LATE]) {
    const steel = c.year === 1943
    lines.push(
      `INSERT INTO "Coin" (id, country, denomination, year, "mintMark", variety, name, "diameterMm", "weightG", material, "isKeyDate", status, "createdAt", "updatedAt") VALUES ` +
        `(${q(c.id)}, 'USA', 'Cent', ${c.year}, ${q(c.mint)}, '', 'Lincoln Wheat Cent', 19.05, ${steel ? 2.7 : 3.11}, ${q(steel ? 'Zinc-coated steel' : 'Bronze')}, false, 'approved', ${q(FIXED_TS)}, ${q(FIXED_TS)}) ON CONFLICT DO NOTHING;`,
    )
  }

  const canon = [
    [CANON_EARLY, 'Lincoln Wheat Cents 1941-1945', 'Every Lincoln Wheat Cent year and mint mark from 1941 to 1945.', EARLY, 1],
    [CANON_LATE, 'Lincoln Wheat Cents 1946-1950', 'Every Lincoln Wheat Cent year and mint mark from 1946 to 1950.', LATE, 101],
  ]
  for (const [id, name, desc, coins, base] of canon) {
    lines.push(`INSERT INTO "CanonicalSet" (id, name, description, source, "templateVersion") VALUES (${q(id)}, ${q(name)}, ${q(desc)}, 'seed-template', 'v1') ON CONFLICT DO NOTHING;`)
    coins.forEach((c, i) => {
      lines.push(`INSERT INTO "CanonicalSetCoin" (id, "canonicalSetId", "coinId", position) VALUES (${q(uuid('cc01', base + i))}, ${q(id)}, ${q(c.id)}, ${i}) ON CONFLICT DO NOTHING;`)
    })
  }

  const sets = [
    [OWNER_SET, 'Wheat Cents 1941-1945', null, EARLY, 1],
    [MIN_GRADE_SET, 'Wheat Cents 1946-1950', 'VF', LATE, 101],
    [EMPTY_SET, 'Empty set', null, [], 0],
  ]
  for (const [id, name, minGrade, coins, base] of sets) {
    lines.push(`INSERT INTO "UserSet" (id, "userId", name, "minGrade", "createdAt", "updatedAt") VALUES (${q(id)}, ${owner}, ${q(name)}, ${minGrade ? `'${minGrade}'` : 'NULL'}, ${q(FIXED_TS)}, ${q(FIXED_TS)}) ON CONFLICT DO NOTHING;`)
    coins.forEach((c, i) => {
      lines.push(`INSERT INTO "UserSetCoin" (id, "userSetId", "coinId", position) VALUES (${q(uuid('5c01', base + i))}, ${q(id)}, ${q(c.id)}, ${i}) ON CONFLICT DO NOTHING;`)
    })
  }

  const owned = [
    // OWNER_SET: 1941 complete, 1942 two of three, 1943 one, 1944 two, 1945 none (8 of 15)
    [owner, pick(EARLY, 1941, ''), null], [owner, pick(EARLY, 1941, 'D'), null], [owner, pick(EARLY, 1941, 'S'), null],
    [owner, pick(EARLY, 1942, ''), null], [owner, pick(EARLY, 1942, 'D'), null],
    [owner, pick(EARLY, 1943, ''), null],
    [owner, pick(EARLY, 1944, 'D'), null], [owner, pick(EARLY, 1944, 'S'), null],
    // MIN_GRADE_SET (min VF): F, VG and ungraded need an upgrade; XF, VF, AU meet it
    [owner, pick(LATE, 1946, ''), 'F'], [owner, pick(LATE, 1946, 'D'), 'XF'],
    [owner, pick(LATE, 1947, ''), 'VG'], [owner, pick(LATE, 1947, 'S'), 'VF'],
    [owner, pick(LATE, 1948, 'D'), null], [owner, pick(LATE, 1949, ''), 'AU'],
    // visitor: 3 of OWNER_SET's coins
    [visitor, pick(EARLY, 1941, ''), null], [visitor, pick(EARLY, 1942, 'S'), 'VF'], [visitor, pick(EARLY, 1944, ''), null],
  ]
  for (const [user, coinId, grade] of owned) {
    lines.push(`INSERT INTO "Ownership" ("userId", "coinId", grade, "ownedAt") VALUES (${user}, ${q(coinId)}, ${grade ? `'${grade}'` : 'NULL'}, ${q(FIXED_TS)}) ON CONFLICT DO NOTHING;`)
  }

  lines.push('COMMIT;')
  return lines.join('\n') + '\n'
}

async function api(pathname, body) {
  const res = await fetch(state.apiBase + pathname, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  })
  const text = await res.text()
  return { status: res.status, text }
}

async function ensureData() {
  if (!state.apiBase || !state.container) throw new Error('setup hook: start() did not run')
  if (!state.dataReady) {
    state.dataReady = (async () => {
      for (const email of Object.values(USERS)) {
        const r = await api('/auth/register', { email, password: PASSWORD })
        if (r.status !== 201 && r.status !== 200 && r.status !== 409) {
          throw new Error(`register ${email} failed: ${r.status} ${r.text.slice(0, 200)}`)
        }
      }
      const r = docker(['exec', '-i', state.container, 'psql', '-q', '-U', PG.user, '-d', PG.db, '-v', 'ON_ERROR_STOP=1'], { input: buildSql() })
      if (r.code !== 0) throw new Error(`seeding the throwaway database failed: ${r.out.slice(-800)}`)
    })()
    state.dataReady.catch(() => {
      state.dataReady = null
    })
  }
  return state.dataReady
}

async function tokenFor(user) {
  const cached = state.tokens[user]
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached.token
  const r = await api('/auth/login', { email: USERS[user], password: PASSWORD })
  if (r.status !== 200) throw new Error(`login as ${user} failed: ${r.status} ${r.text.slice(0, 200)}`)
  const token = JSON.parse(r.text).accessToken
  state.tokens[user] = { token, at: Date.now() }
  return token
}

const STRIP_REQUEST = new Set(['if-none-match', 'if-modified-since', 'content-length', 'host'])
const STRIP_RESPONSE = new Set(['content-length', 'content-encoding', 'transfer-encoding', 'etag'])

async function installAlias(page, fx) {
  const origin = new URL(page.url()).origin
  const cors = { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' }
  const apiPrefix = state.apiBase + '/'
  await page.route(
    (url) => url.href.startsWith(apiPrefix),
    async (route) => {
      const req = route.request()
      const url = req.url()
      const real = url.split(`/${ALIAS}`).join(`/${fx.setId}`)
      try {
        if (fx.failGaps && req.method() === 'GET' && new URL(url).pathname.endsWith(`/sets/${ALIAS}/gaps`)) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            headers: cors,
            body: JSON.stringify({ statusCode: 500, message: 'Internal server error' }),
          })
          return
        }
        if (req.method() !== 'GET') {
          await (real === url ? route.continue() : route.continue({ url: real }))
          return
        }
        const headers = {}
        for (const [k, v] of Object.entries(req.headers())) if (!STRIP_REQUEST.has(k)) headers[k] = v
        const res = await route.fetch({ url: real, headers })
        const body = (await res.text()).split(fx.setId).join(ALIAS)
        const outHeaders = {}
        for (const [k, v] of Object.entries(res.headers())) if (!STRIP_RESPONSE.has(k)) outHeaders[k] = v
        await route.fulfill({ status: res.status(), headers: { ...outHeaders, ...cors }, body })
      } catch {
        await route.abort().catch(() => {})
      }
    },
  )
}

export async function seed({ page, fixture }) {
  const fx = FIXTURES[fixture]
  if (!fx) throw new Error(`setup hook: unknown fixture "${fixture}"`)
  await ensureData()
  if (!fx.user) {
    // Signed out: no access token and no refresh cookie, so the app can't silently sign in.
    await page.context().clearCookies()
    await page.evaluate((key) => window.localStorage.removeItem(key), TOKEN_KEY)
    return
  }
  const token = await tokenFor(fx.user)
  await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [TOKEN_KEY, token])
  await installAlias(page, fx)
}
