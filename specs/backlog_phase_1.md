# Phase 1 Backlog — The Wedge (~1 week)

Source: [docs/prd.md](../docs/prd.md) v1.1, §5 (Phase 1) and §11 (build plan), plus [docs/system-design.md](../docs/system-design.md) (design decisions D1–D4, API contract shapes, key flows). Scope firewall = the exit test at the bottom: if a task isn't needed for that path, it's not Phase 1.

Conventions used throughout: denomination is the shared enum (never free text), no-mark coins/slots store `mintMark = null` (never `"P"`), link replacement is transactional. See PRD §4.2, §6.3, §9. If a design decision (D1–D4) proves wrong during the build, record the reversal in `docs/decisions.md` — don't silently diverge.

---

## 0. Project init (git + workspace) — Day 1

- [x] 0.1 `git init`, root `.gitignore` (node_modules, .env\*, dist, .next), initial commit with `docs/` + `CLAUDE.md` + this backlog
- [ ] 0.2 Create GitHub repo (public — free GitHub Actions + portfolio visibility), push
- [ ] 0.3 pnpm workspace skeleton: root `package.json`, `pnpm-workspace.yaml`, empty `apps/web`, `apps/api`, `packages/shared`, `seed/templates/` dirs (PRD §8.1 layout)
- [ ] 0.4 Root tooling: TypeScript base config, Prettier + ESLint shared config, `engines`/`packageManager` pinned
- [ ] 0.5 Update `CLAUDE.md` project-status section with the real commands as they appear (dev, test, migrate, seed)

## 1. Backend skeleton + DB — Days 1–2

- [ ] 1.1 Scaffold NestJS in `apps/api` (`@nestjs/cli`), wire global `ValidationPipe` (`whitelist: true`, `transform: true`), `/api/v1` prefix, `GET /health`, CORS restricted to exactly two origins: `CORS_ORIGIN` (Vercel prod URL) + `http://localhost:3000` (PRD §9, SD §2). Module layout per SD D2: `Prisma`, `Auth`, `Sets`, `UserSets`, `Coins` (which imports `Linking`) — five flat entity modules, no extra layering
- [ ] 1.2 `packages/shared`: `Denomination` and `Grade` enums + the SD §4 contract types (`UserSetSummary`, `GapViewResponse`/`GapSlot`, `CoinMutationResponse`/`SlotSuggestion`, link response `{ coin, replacedCoinId }`) — the package is the single source of truth; if code and SD §4 drift, the package wins
- [ ] 1.3 Prisma init in `apps/api`; schema from PRD §6.2 — `User`, `CollectionSet` (with `denomination`), `SetSlot` (with `@@unique([setId, year, mintMark, label])`), `UserSet` (`@@unique([userId, setId])`), `CoinItem` (`@@unique([userId, slotId])`, `onDelete: SetNull` on slot FK)
- [ ] 1.4 Create Neon project, `DATABASE_URL` (pooled connection string) in `.env` (+ `.env.example` committed at both app roots — SD §7), first migration applied
- [ ] 1.5 Swagger wired (`@nestjs/swagger` at `/api/docs`) — decorators added per-endpoint from here on, not as a later pass
- [ ] 1.6 Deploy the (near-empty) API to Render now: root dir `apps/api`, build via workspace filter, `GET /health` as Render's health check, env vars `DATABASE_URL` + `JWT_SECRET` + `CORS_ORIGIN`, listen on `process.env.PORT` (SD §7). Surfacing deploy problems while the app is tiny is the point (PRD §11)

## 2. Auth — Day 2

- [ ] 2.1 Auth module: `POST /auth/register`, `POST /auth/login` (bcrypt cost 10, JWT `{ sub, email }` HS256 in response body, 7-day expiry, no refresh flow — PRD §9, SD §5). Register normalizes email to lowercase, 409 on duplicate; login returns uniform 401 "invalid credentials" for both unknown email and wrong password — no timing-equalization theater beyond bcrypt
- [ ] 2.2 Passport JWT strategy + global auth guard with `@Public()` opt-out on the two auth routes; `@CurrentUser()` decorator. Guard order (SD D2): `ThrottlerGuard` → `JwtAuthGuard` → `ValidationPipe`; ownership checks stay in services (`ForbiddenException`), not guards
- [ ] 2.3 DTO validation: email format, password min length; 400s with field-level messages; errors use Nest's default `{ statusCode, message, error }` shape everywhere (SD §4)
- [ ] 2.4 `@nestjs/throttler` on `/auth/*` (~5/min per IP), generous default elsewhere
- [ ] 2.5 e2e test: register → login → hit a guarded route; wrong password → 401

## 3. Sets, templates, seed — Day 3

- [ ] 3.1 Seed script (`prisma/seed.ts` + `prisma.seed` hook): walks `seed/templates/*.json`, upserts `CollectionSet` by name, then diffs slots on `(year, mintMark, label)` **in script code** — Postgres NULL-distinctness makes the DB unique constraint advisory for null-mint keys, so a naive `upsert` won't match Philadelphia slots (SD §6). Update matched slots in place (IDs stable ⇒ links survive), insert new, delete absent — **never wholesale delete-and-recreate** (PRD §6.4). One transaction per template; fail the whole run loudly on a malformed file
- [ ] 3.2 Author 3 templates as JSON (start with the ones covering your real coins — e.g. Lincoln Wheat Cents, State Quarters, Morgan Dollars). Philadelphia/no-mark issues = `mintMark: null`. Cross-check each list against a second source (PRD §13)
- [ ] 3.3 Sets endpoints: `GET /sets` (`isTemplate` filter; non-templates scoped to owner), `POST /sets/:id/activate` (idempotent), `GET /user-sets` → `UserSetSummary[]` with `ownedSlots`/`totalSlots`/`isComplete` — counts via two `groupBy` queries merged in memory, no per-set loop (SD D4); the % itself is derived client-side (one rounding rule, one place), `DELETE /user-sets/:id` (links survive)
- [ ] 3.4 e2e test: seed → activate → activate again (no dup) → list user-sets shows 0%

## 4. Coins + auto-suggest — Days 4–5

- [ ] 4.1 Coins CRUD: `GET/POST /coins`, `PATCH /coins/:id`, `DELETE /coins/:id` (delete unlinks). Fields per PRD §6.3; denomination/grade from shared enums; mint-mark normalization (`"P"` → `null` where applicable) at the API boundary
- [ ] 4.2 `LinkingService` (own `LinkingModule`, imported by `CoinsModule`) — **sole writer of `CoinItem.slotId` and sole implementor of the match rule** (SD D3); nothing else touches `slotId`. `suggest`: match `set.denomination + year + mintMark` against slots in active sets only (join through `UserSet`), null-safe mint equality (`mintMark: coin.mintMark ?? null` — Prisma treats `null` as `IS NULL`); returns `SlotSuggestion[]` incl. `currentlyLinkedCoinId` inside `CoinMutationResponse` from `POST /coins` and from `PATCH` when denomination/year/mint changed (PRD §4.2)
- [ ] 4.3 Link endpoints via `LinkingService`: `POST /coins/:id/link` — one `$transaction`: assert ownership + pursued set, `updateMany` displace occupant (0 or 1 rows), then link; the `(userId, slotId)` unique constraint is the backstop, never the mechanism. Returns `{ coin, replacedCoinId }` (UI toasts "replaced — old coin kept"). `POST /coins/:id/unlink`; ownership checks at service layer (403 on foreign coin/slot)
- [ ] 4.4 e2e tests: no-mark Philadelphia coin matches its `null`-mint slot (the §13 convention-drift test); 1909-S coin returns both S and S-VDB candidates; relink replaces atomically
- [ ] 4.5 Gap endpoint: `GET /user-sets/:id/gap` → `GapViewResponse` — one `findMany` on `SetSlot` with a filtered `include` of the current user's linked coin, ordered by `sortOrder` (SD D4); owned/missing is `linkedCoin` nullability, nothing more. Don't over-engineer (PRD §6.1); no new indexes — the unique constraints already cover the hot paths

## 5. Frontend — Days 4–6 (overlaps with 4)

- [ ] 5.1 Scaffold Next.js (App Router) in `apps/web`. Data fetching per SD D1: all authenticated data fetched client-side (TanStack Query) directly against the Render API — server components render only the static shell, no RSC data fetching, no proxy layer. JWT in `localStorage`, attached as `Authorization: Bearer`; redirect-to-login on 401. Route groups per SD §3: `(auth)/login|register` (redirect away if token present), `(app)/*` layout guard (no token → `/login`)
- [ ] 5.2 Register/Login pages with inline field errors
- [ ] 5.3 Set catalog page (templates + Activate button) and My Sets page (completion % per set — derived client-side from `ownedSlots/totalSlots`, link to gap view)
- [ ] 5.4 Coin list + coin add/edit form (enum dropdowns for denomination/grade, "None" default for mint mark); delete with confirm
- [ ] 5.5 Auto-suggest panel post-save, driven by `CoinMutationResponse.suggestions`: `[]` = no panel, 1 = one-tap confirm, >1 = candidate picker (routine path, not a fallback — PRD §4.3); `currentlyLinkedCoinId != null` ⇒ "Replace current link" label. Confirmed link invalidates `['gap', userSetId]`, `['user-sets']`, `['coins']` queries (SD §3)
- [ ] 5.6 Skeleton loader on first load (Render cold start, ~30–60s — PRD §10); generous fetch timeout (~75 s) with one retry (SD §6) — no keep-warm

## 6. Gap view — Day 7 (the product; most polish goes here)

- [ ] 6.1 Grid/list per PRD §4.1: owned/missing via color + icon, key-date badge on missing (muted on owned), header with name, completion %, raw count ("38 / 96"). Slots come pre-ordered by `sortOrder`; grid grouping is client-side presentation (SD §4). Slot display rule: `label ?? year-mintMark`
- [ ] 6.2 Slot interactions: missing → link-a-coin flow (search own coins, or "add new" pre-filled with year/mint); owned → linked coin detail + unlink
- [ ] 6.3 "Complete ✓" treatment for a finished set
- [ ] 6.4 `null` mint mark renders as year only ("1909", not "1909-P")

## 7. Deploy + acceptance — Day 7

- [ ] 7.1 Frontend to Vercel (root dir `apps/web`), `NEXT_PUBLIC_API_URL` (Render base URL incl. `/api/v1`); set `CORS_ORIGIN` on Render to the real Vercel origin and confirm
- [ ] 7.2 Seed templates into the Neon prod DB via the seed script run from the dev machine against prod `DATABASE_URL` (the only sanctioned path — PRD §6.4; no runtime/auth surface, SD §2)
- [ ] 7.3 GitHub Actions CI: one workflow — install → lint → typecheck → `apps/api` tests against a **Postgres service container** (the invariants live in Postgres; mocking Prisma would test nothing — SD §7). CI is a status check, not a deploy gate: Vercel/Render auto-deploy on push to `main`
- [ ] 7.4 **Exit test on the deployed app:** register → activate Lincoln Cents template → add 5 real coins → auto-suggest links them → gap view shows 5 owned / N missing with correct completion %. Phase 1 is done when this passes; anything else waits for Phase 2

---

## Explicitly NOT in Phase 1 (resist)

- Custom set builder, search/filter, dashboard (Phase 2)
- Photos/uploads of any kind (Phase 3) — `imageUrls` stays an unused empty array
- Third slot state, want-list, values, CSV, sharing (Phase 4)
- Password reset (non-goal, PRD §2) · refresh tokens (decided against, PRD §9) · keep-warm cron (cold start accepted, PRD §10)
- RSC data fetching / cookie + route-handler proxy (rejected in SD D1 — client-side + `localStorage` JWT is the decision; revisit only per SD §8)
- Denormalized completion-counter column (rejected, SD D4) · extra indexes for the suggest query (add only if measured) · CQRS/hexagonal layering (rejected, SD D2)
- Metrics/tracing/alerting — Render logs + Nest default logger + `/health` is the whole observability story (SD §7)
