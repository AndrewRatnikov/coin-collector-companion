# Public pages render on the server, fetching the API over HTTP through one server-only helper with Next's data cache and a 5 s timeout

- **Status:** Accepted
- **Date:** 2026-11-26
- **Source:** orchestrator run `run_20261127_065505` (growth backlog Step 3, items 3.1, 3.5, 3.9-3.12)
- **Code:** `apps/web/src/lib/server-api.ts`, `apps/web/src/app/sitemap.ts`, `apps/web/src/app/robots.ts`, `apps/web/src/app/llms.txt/route.ts`, `apps/web/src/app/layout.tsx`

## Context

Every page in `apps/web` fetches its data in the browser. A crawler or an AI agent that doesn't run JavaScript sees the page shell, a skeleton and no coins. Step 3 of `docs/backlog_growth.md` is about search engines and AI agents finding the catalog, the curated checklists and the public sets, so those pages need their content in the HTML the server sends.

The constraints:

- Web (Next.js on Vercel) and API (NestJS on Render) are separate services with a real HTTP boundary (CLAUDE.md). No backend logic moves into Next.js.
- The API runs on Render's free plan and sleeps after inactivity. A cold start takes 30-60 s. The database is Neon on its free plan, which has limited compute hours and resumes in a few hundred ms.
- The root layout reads the `ccc-locale` cookie ([2026-11-16-locale-cookie-read-in-root-layout](2026-11-16-locale-cookie-read-in-root-layout.md)), so every page renders dynamically. That ADR said Step 3 would revisit rendering.
- The catalog holds about 1,700 approved coins in the fixtures (about 360 in production until the 2.9 import), each with its own page.

## Decision

**(a) Pages.** These public pages will render on the server:

- the catalog index `/catalog`
- the coin page `/catalog/[coinId]`
- the checklist list `/sets/canonical` and the checklist detail `/sets/canonical/[id]`
- the public set detail `/sets/public/[id]`

They are converted in 3.2-3.4, not in this run. The landing page `/` and `/glossary` already render their content without API data: their text is static, and the landing counts are an enhancement that loads after hydration, so they don't need this. This run uses the helper for the sitemap and `/llms.txt` only.

**(b) Fetching.** Server components and metadata routes fetch the API over HTTP through **one** server-only helper, `apps/web/src/lib/server-api.ts`:

- Its first statement is `import 'server-only';`, so a client component that imports it fails the build.
- The base URL comes from the server-only env var `API_URL`, falling back to `NEXT_PUBLIC_API_URL` (a blank `API_URL` counts as unset). `API_URL` lets the server use a different address than the browser later (an internal one, say) without changing code.
- Requests go through Next's data cache with `next: { revalidate }`:
  - **Lists: `LIST_REVALIDATE_SECONDS = 3600` (1 hour).** Lists change when a user creates or publishes a set, a submission is approved, or an import or seed runs. An hour of staleness is fine for crawlers, and it limits wake-ups of the Render API and the Neon database to about one per list URL per hour.
  - **Coin pages: `COIN_REVALIDATE_SECONDS = 86400` (1 day).** A coin row only changes through the offline import or an admin edit. With about 1,700 coin pages, a crawler sweep without a long cache would keep Render awake and use up Neon's free-plan compute hours.
- The helper never sends `Authorization` or `Cookie`. Cached responses stay anonymous and shared between visitors, and Next doesn't cache a fetch that carries either header anyway.

**(c) Timeout.** `SERVER_FETCH_TIMEOUT_MS = 5000`. A warm API answers in well under a second, including a Neon resume. A Render cold start takes 30-60 s, and making a crawler or a Vercel function wait that long is worse than answering without the data. On a timeout, a network error or a non-2xx response, the helper throws `ServerApiError` (kind `timeout`, `network` or `http`, with the status for `http`). A failed response is never written to the data cache (Next stores only successful responses), so the next request tries again.

When the timeout is hit:

- **Pages (3.2-3.4):** the page renders with HTTP 200 and its existing client-side loading path: the skeleton, the "waking the server" notice, and the browser query with its 75 s timeout. A real API 404 becomes `notFound()`.
- **`sitemap.xml`:** it keeps the static entries and every group (checklists, public sets, coins) that loaded; a group with any failed request is left out whole. It never throws.
- **`/llms.txt`:** it is served without its `## Covered series` section.

Both routes are `force-dynamic`, so a degraded output is never stored and the next request rebuilds it.

**(d) Ownership layer.** The server-rendered output is the anonymous view only: catalog and set data with no `owned`, `inSetsCount` or progress fields. Client components receive that data as props or initial data. The signed-in parts (ownership marks, the "in N sets" badges, set progress, the ownership panel) come from the existing TanStack queries, which only run once the stored token has been read after mount. So the first client render matches the server HTML, hydration doesn't mismatch, and the signed-in layer attaches afterwards without changing what the server rendered. This lines up with 3.7: `getStoredToken()` must not be read during render.

**(e) Locale cookie.** The root layout keeps reading `ccc-locale` with `cookies()`, so every page stays dynamically rendered, and that is accepted. A dynamic render still uses the data cache for a `fetch` with an explicit `revalidate`: the page HTML is rendered per request, but the API responses come from the cache. Metadata routes (`sitemap.ts`, `robots.ts`, `llms.txt/route.ts`) are outside the layout. `sitemap.ts` and `llms.txt/route.ts` set `export const dynamic = 'force-dynamic'`, so they never run at build time (the build must not call the API), and their API responses are still cached through the explicit `revalidate`. `robots.ts` fetches nothing and stays static.

**(f) Language.** Crawlers send no `ccc-locale` cookie, so they get English. Locale-prefixed URLs (`/es/...`, `/uk/...` with `hreflang` alternates) are the later option for indexing the Spanish and Ukrainian pages. They are not built now.

**Crawler policy and agent entry points (3.9, 3.10, 3.12).** `robots.ts` allows every crawler, including AI training crawlers (GPTBot, ClaudeBot, Google-Extended, CCBot), with one explicit group per named bot that repeats the disallow list for the signed-in and auth-only paths, because a crawler follows only its most specific group. `/llms.txt` is built from code with the checklist counts from the API, and links the OpenAPI JSON that the API serves at the fixed path `/api/docs-json` (`https://api.coincompanion.app/api/docs-json` in production), where the public read operations carry `security: []`. The public API base URL in llms.txt comes from `NEXT_PUBLIC_API_URL`, because the domain lives only in env vars.

## Alternatives considered

- **Static generation at build time** (`generateStaticParams`, a prerendered sitemap). Rejected: the Vercel build would depend on the Render API being awake. A cold API would fail the build, or ship an empty sitemap and empty pages until the next deploy.
- **Moving API logic into Next.js** (Prisma or route handlers in `apps/web` that read the database). Rejected: CLAUDE.md requires separate services with a real API boundary, and it would duplicate the approval and visibility rules the API enforces.
- **`'use cache'` / `cacheComponents`.** Not now: it changes the rendering model of the whole app. The fetch data cache is enough.
- **Moving the locale cookie read out of the root layout** so public pages can be static. Not done: the cost of dynamic rendering is small once the API data is cached, and the 2026-11-16 decision stays as it is.
- **A compact ids endpoint for the sitemap.** Not now: the sitemap pages through `GET /catalog?page=n&limit=100`, 17 requests for the fixtures, which is under the 20-request threshold. Add it when the catalog passes about 2,000 approved coins (euro coins, 2.7).

## Consequences

- There is one helper to change for every server-side API read: base URL, cache intervals and timeout live in `server-api.ts`.
- `API_URL` is optional. `NEXT_PUBLIC_SITE_URL` is now required in production, because robots, the sitemap, llms.txt and the JSON-LD build absolute URLs from it (falling back to `http://localhost:3000`).
- A cold API costs crawlers some content on that request, not an error: the sitemap or llms.txt is partial, and pages fall back to the client-side loading path.
- The sitemap passes the 20-request threshold once the catalog grows past about 2,000 approved coins. Then add the compact ids endpoint (approved coins only, `CATALOG_COIN_SELECT` rules).
- The crawler policy lives in `robots.ts` (`AI_CRAWLER_USER_AGENTS`, `DISALLOWED_PATHS`). Blocking a bot later is a one-line change to its group.
- Tests: `server-api.test.ts` (base URL, headers, revalidate, timeout, error kinds, the `server-only` marker), `site-url.test.ts` (`siteOrigin`), `robots.test.ts`, `sitemap.test.ts` (only public sets and approved coins, paging, per-group failure), `llms-txt.test.ts` and `llms.txt/route.test.ts` (content, content type, degraded output), `website-json-ld.test.tsx` and `landing-json-ld.test.tsx` (the JSON-LD parses, one block on the landing), and `apps/api/src/swagger.spec.ts` (the served OpenAPI JSON and its `security` markings).
