# Coin Collector Companion — System Design (v1, Phase 1–2)

Companion to [prd.md](prd.md) v1.1. The PRD owns product decisions, the data model (§6), the endpoint list (§7), and hosting (§10) — none of that is restated here. This document covers what the PRD leaves open: internal structure of the two services, exact API contracts, the critical request flows, and an honest look at what to revisit if the system outgrows personal scale.

**Design decisions made in this document** (not in the PRD): frontend data-fetching strategy (D1), NestJS module boundaries (D2), a `LinkingService` as the single owner of link semantics (D3), completion-% query shape (D4), response contract shapes destined for `packages/shared` (§4). If any of these prove wrong during the build, record the reversal in `docs/decisions.md` rather than editing history here.

---

## 1. Requirements summary

| Class | Requirement | Source |
| --- | --- | --- |
| Functional | Gap view per pursued set (two-state slots, completion %, key dates); coin CRUD; auto-suggest linking; template catalog + activation; email/password auth | PRD §4, §5 |
| Scale | Personal: ≤ ~10 users, 100–500 coins each, sets of ≤ ~200 slots. No pagination, no caching | PRD §3, §9 |
| Latency | Interactive CRUD feel on a warm backend; ~30–60 s cold start explicitly accepted | PRD §10 |
| Availability | Demo-grade. Free tiers, no SLO, no redundancy | PRD §10 |
| Cost | $0/month | PRD §10 |
| Constraints | Solo dev, ~1 week per phase; stack fixed (Next.js / NestJS / Prisma / Postgres); separate FE/BE services non-negotiable | PRD §8 |

The scale row drives everything below: correctness constraints are enforced at the database (unique indexes, transactions) while throughput concerns are deliberately ignored. When a decision trades "scales past 10k users" against "ships this week," this design always picks the latter and records what to revisit (§8).

## 2. System context

```
                    ┌────────────────────────────────────────────┐
                    │              GitHub (monorepo)             │
                    │  apps/web · apps/api · packages/shared     │
                    │  seed/templates/*.json · GitHub Actions CI │
                    └──────┬──────────────────────┬──────────────┘
                           │ auto-deploy on push  │ auto-deploy on push
                           ▼                      ▼
┌──────────┐  HTTPS  ┌───────────┐  HTTPS/JSON ┌───────────┐  TCP/TLS  ┌────────┐
│ Browser  │◄───────►│  Vercel   │             │  Render   │◄─────────►│  Neon  │
│          │         │  Next.js  │             │  NestJS   │  (Prisma) │Postgres│
│          │◄────────┼───────────┼────────────►│  /api/v1  │           └────────┘
│          │  fetch + Bearer JWT (direct,      │  /api/docs│                ▲
└──────────┘  browser → Render; CORS-gated)    └───────────┘                │
                                                                            │
                                    `pnpm prisma db seed` (dev machine / ───┘
                                     one-off job) reads seed/templates/
```

Two runtime paths matter:

1. **Browser → Render API directly.** The Next.js server is *not* a proxy for API data (see D1). CORS on the API allows exactly two origins: the Vercel production URL and `http://localhost:3000`.
2. **Seed path.** Template JSON enters Postgres only via `prisma db seed` (PRD §6.4), run from the dev machine against dev or prod `DATABASE_URL`. It is not an API endpoint — no runtime surface, no auth surface.

## 3. Frontend design (`apps/web`)

### D1 — Data fetching: client-side, token in `localStorage`

**Decision:** all authenticated data is fetched from client components (`fetch` wrapper or TanStack Query) directly against the Render API, with the JWT kept in `localStorage` and attached as `Authorization: Bearer`. Server components render only the static shell (layout, unauthenticated pages).

**Why not RSC data fetching:** App Router server components fetch on the Vercel server, which would need the user's JWT. The PRD (§9) rules out cross-origin cookies, so the token would have to travel via a first-party cookie plus a route-handler proxy layer — roughly a day of plumbing that exists only to route data through a second server, adding a hop in front of an API that already cold-starts. At this scale the SPA pattern is simpler, faster to build, and easier to reason about; the cold-start skeleton loader (PRD §10) drops in naturally as a query loading state.

**Trade-offs accepted:** `localStorage` is readable by JS, so XSS ⇒ token theft — mitigated by React's default escaping, no `dangerouslySetInnerHTML`, and a 7-day expiry; acceptable for a coin checklist, would be re-decided for anything sensitive. Less server-component showcase for the portfolio — the App Router routing/layout/streaming story is still demonstrated; if more RSC depth is wanted, revisit in the Phase 2 polish pass, not on the Phase 1 critical path.

### Route map

```
app/
├── (auth)/login, (auth)/register     # public; redirect away if token present
└── (app)/                            # layout guard: no token → redirect to /login
    ├── sets/                         # Set catalog (templates + Activate)
    ├── my-sets/                      # pursued sets + completion %
    ├── my-sets/[userSetId]/          # Gap view (the product)
    ├── coins/                        # coin list
    └── coins/new, coins/[id]/edit    # form + post-save auto-suggest panel
```

State management: TanStack Query for server state (per-user data, invalidated on mutation — e.g. a confirmed link invalidates `['gap', userSetId]`, `['user-sets']`, `['coins']`); no global client-state library. Form state stays in the form (react-hook-form or controlled inputs — implementer's choice).

## 4. API contracts (the shapes the PRD doesn't spec)

These are the response types for the endpoints whose payloads are non-obvious. They live as TypeScript types in `packages/shared` (single source of truth for both apps); this section is their design rationale, the package is their home — if they drift, the package wins.

```ts
// GET /api/v1/user-sets  →  UserSetSummary[]
interface UserSetSummary {
  userSetId: string;
  set: { id: string; name: string; category: string; denomination: Denomination };
  totalSlots: number;
  ownedSlots: number;      // client derives % — one rounding rule, defined in one place (client)
  isComplete: boolean;     // ownedSlots === totalSlots && totalSlots > 0
  activatedAt: string;     // ISO 8601
}

// GET /api/v1/user-sets/:id/gap  →  GapViewResponse
interface GapSlot {
  slotId: string;
  year: number;
  mintMark: string | null;
  label: string | null;      // client renders label ?? `${year}${mintMark ? `-${mintMark}` : ''}`
  sortOrder: number;
  isKeyDate: boolean;
  linkedCoin: {              // null = missing; the two-state rule is this field's nullability
    coinId: string;
    grade: Grade | null;
    acquiredDate: string | null;
  } | null;
}
interface GapViewResponse {
  userSetId: string;
  set: { id: string; name: string; category: string; denomination: Denomination };
  totalSlots: number;
  ownedSlots: number;
  slots: GapSlot[];          // ordered by sortOrder; grid grouping is client-side presentation
}

// POST /api/v1/coins (and PATCH when match key changed)  →  CoinMutationResponse
interface SlotSuggestion {
  slotId: string;
  setName: string;           // "Lincoln Wheat Cents"
  slotLabel: string;         // display-ready: "1909-S VDB" / "1955"
  isKeyDate: boolean;
  currentlyLinkedCoinId: string | null;  // non-null ⇒ UI shows "Replace current link"
}
interface CoinMutationResponse {
  coin: CoinDto;
  suggestions: SlotSuggestion[];  // [] = no panel; 1 = one-tap confirm; >1 = picker (routine, PRD §4.3)
}

// POST /api/v1/coins/:id/link  →  { coin: CoinDto; replacedCoinId: string | null }
// (replacedCoinId lets the UI toast "replaced 1909-S — old coin kept in collection")
```

Contract conventions: `null` is meaningful (`mintMark: null` = no mark — PRD §6.3) and never interchangeable with field omission; all timestamps ISO 8601 UTC strings; errors use Nest's default `{ statusCode, message, error }` (PRD §9). Swagger at `/api/docs` is generated from the DTO classes that implement these interfaces, so the published docs can't drift from the wire format.

## 5. Backend design (`apps/api`)

### D2 — Module boundaries

```
AppModule
├── PrismaModule        (global; PrismaService)
├── AuthModule          (register/login, JwtStrategy, global JwtAuthGuard, ThrottlerModule config)
├── SetsModule          (GET /sets, POST /sets/:id/activate; Phase 2: create/generate/bulk-slots)
├── UserSetsModule      (GET /user-sets, DELETE /user-sets/:id, GET /user-sets/:id/gap)
└── CoinsModule         (coin CRUD; imports LinkingModule)
    └── LinkingModule   (LinkingService: suggest / link / unlink — see D3)
```

Five modules, one level deep — mirrors the entity model, so the API structure is explainable in the five minutes the PRD's success criteria (§12) allow. Guard stack, outermost first: `ThrottlerGuard` (global; strict override on `/auth/*`) → `JwtAuthGuard` (global; `@Public()` opt-out on the two auth routes) → per-route `ValidationPipe` (global, `whitelist: true`, `transform: true`). Ownership checks live in services, not guards (PRD §9), because they need the loaded resource: services throw `ForbiddenException` when `resource.userId !== currentUser.id`.

### D3 — `LinkingService` owns all link semantics

One service is the sole writer of `CoinItem.slotId` and the sole implementor of the match rule. Consumed by: `POST /coins` and `PATCH /coins/:id` (suggestions), the link/unlink endpoints, and the gap-view "link a coin" flow. Nothing else touches `slotId` — that's what keeps the §4.2 invariants in one findable place.

```
suggest(userId, coin):
  SELECT slot.*, set.name, linked.id AS currentlyLinkedCoinId
  FROM SetSlot slot
  JOIN CollectionSet set  ON set.id = slot.setId AND set.denomination = coin.denomination
  JOIN UserSet us         ON us.setId = set.id AND us.userId = :userId     -- active sets only
  LEFT JOIN CoinItem linked ON linked.slotId = slot.id AND linked.userId = :userId
  WHERE slot.year = :year
    AND slot.mintMark IS NOT DISTINCT FROM :mintMark    -- null matches null, exactly (§4.2)
```

(Expressed in Prisma as a `setSlot.findMany` with relation filters; the SQL is the semantics. `IS NOT DISTINCT FROM` is the null-safe equality the mint-mark convention requires — in Prisma, `mintMark: coin.mintMark ?? null` compiles correctly since Prisma filters treat `null` as `IS NULL`.)

```
link(userId, coinId, slotId):        # single prisma.$transaction (PRD §9)
  1. load coin, slot(+set); assert coin.userId === userId; assert UserSet(userId, slot.setId) exists
  2. updateMany CoinItem {userId, slotId} → slotId = null    # displace occupant (0 or 1 rows)
  3. update coin → slotId                                     # unique (userId, slotId) is the backstop
  4. return { coin, replacedCoinId }
```

The unique constraint remains the safety net if application logic ever races or regresses — a violated invariant is a thrown constraint error, never silent corruption.

### D4 — Completion % without N+1

`GET /user-sets` needs `(ownedSlots, totalSlots)` per pursued set. Loop-per-set is the obvious N+1 trap; at ≤ ~10 sets it would honestly be fine, but the set-based version is the same line count:

```
totals: SELECT setId, COUNT(*) FROM SetSlot WHERE setId IN (…) GROUP BY setId
owned:  SELECT s.setId, COUNT(*) FROM CoinItem c JOIN SetSlot s ON s.id = c.slotId
        WHERE c.userId = :userId AND s.setId IN (…) GROUP BY s.setId
```

Two `groupBy` queries, merged in memory. The gap endpoint is one `findMany` on `SetSlot` with a filtered `include` of the current user's linked coin, ordered by `sortOrder` — the "whole product in one query" the PRD promises. Indexes: the PRD's unique constraints already cover every hot path (`SetSlot(setId, …)` for gap, `CoinItem(userId, slotId)` for owned-lookups); the suggest query's `(year, mintMark)` scan is over hundreds of rows — add an index only if measurement ever says so.

### Auth mechanics

- bcrypt cost 10; JWT payload `{ sub: userId, email }` signed HS256 with `JWT_SECRET`, 7-day expiry, no refresh (PRD §9).
- Register: normalize email to lowercase; on duplicate return 409. Login failures: uniform 401 "invalid credentials" for both unknown email and wrong password — with the throttler (5/min/IP on `/auth/*`), that's proportionate enumeration defense for this app; don't build timing-equalization theater beyond bcrypt's inherent cost.

## 6. Key flows

**Add coin → auto-suggest → link** (the acceptance-test spine):

```
Browser                    API                                  Postgres
   │ POST /coins            │                                       │
   ├───────────────────────►│ validate DTO (enum denom,             │
   │                        │   normalize "P"→null at boundary)     │
   │                        ├── INSERT CoinItem ───────────────────►│
   │                        ├── LinkingService.suggest ────────────►│  (§5 D3 query)
   │◄───────────────────────┤ 201 { coin, suggestions }             │
   │ user confirms slot     │                                       │
   │ POST /coins/:id/link   │                                       │
   ├───────────────────────►│ LinkingService.link — $transaction ──►│  displace + link
   │◄───────────────────────┤ 200 { coin, replacedCoinId }          │
   │ invalidate gap/user-sets/coins queries → UI re-renders         │
```

**Seed** (PRD §6.4, mechanics): for each template file — upsert `CollectionSet` by `name`; diff incoming slots against existing on `(year, mintMark, label)` *in script code* (Postgres NULL-distinctness makes the DB constraint advisory for null-bearing keys); update matched slots in place (IDs stable ⇒ links survive), insert new, delete absent. Wrap per-template in a transaction. Fail the whole run loudly on a malformed file — a partial seed is worse than no seed.

**Cold start** (accepted, PRD §10): first request after idle ≈ 30–60 s (Render wake) + possibly a Neon wake. Frontend handles it with skeleton states and a generous fetch timeout (~75 s) with one retry — no keep-warm, no health-ping cron.

## 7. Deployment & operations

| Env var | Where | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Render, local `.env` | Neon pooled connection string |
| `JWT_SECRET` | Render, local `.env` | generated, never committed |
| `CORS_ORIGIN` | Render | the Vercel production URL |
| `PORT` | Render (provided) | Nest listens on `process.env.PORT` |
| `NEXT_PUBLIC_API_URL` | Vercel, local `.env` | Render base URL incl. `/api/v1` |

`.env.example` committed at both app roots. CI (GitHub Actions): one workflow — `pnpm install` → lint → typecheck → `apps/api` tests against a Postgres service container (real DB for the constraint/transaction tests; the invariants live in Postgres, so mocking Prisma would test nothing). Deploys are Vercel/Render auto-deploy on push to `main` — CI is a status check, not a deploy gate, acceptable for a solo repo.

Observability = Render logs + Nest's default logger, plus a `GET /health` (used by Render's health check). No metrics/tracing/alerting — nothing pages a solo dev on a demo app; the README's cold-start note handles the only "incident" this system can have.

**Backup/restore honesty:** Neon free tier has limited point-in-time restore. The templates are re-seedable from git, but *user coin data is not* — `pg_dump` before schema migrations in prod is the entire DR plan, and it's fine for one real user. Revisit before inviting anyone else's data in.

## 8. What to revisit as it grows

Ordered by which assumption breaks first:

1. **Public read-only collection links (Phase 4)** — the first unauthenticated, unpredictable-traffic surface. Triggers: pagination on coins, caching gap responses (ETag or 60 s CDN cache is plenty), rethinking the free Render instance.
2. **Real third-party users** — password reset + email infra (PRD non-goal reversal, planned), moving off `localStorage` toward httpOnly-cookie + proxy (re-decide D1), real backups (§7), per-user rate limits.
3. **Template catalog growth (50+ sets)** — seed-on-every-deploy gets slow and template *authoring* becomes the bottleneck; consider a validation CI step for template JSON (schema + duplicate-key check) before it bites.
4. **Multi-denomination/mixed sets (Phase 4)** — breaks D3's `set.denomination` join assumption; the match key moves from set-level to slot-level denomination. Contained: it's one service (D3) and one column migration.
5. **Never revisit** (decided, PRD): separate FE/BE services, Prisma, two-state slots, cold-start acceptance.

## 9. Trade-off register (new decisions only)

| # | Decision | Chosen | Rejected | Cost accepted |
| --- | --- | --- | --- | --- |
| D1 | FE data fetching | Client-side + localStorage JWT | RSC fetch via cookie+proxy | XSS token exposure (mitigated), less RSC showcase |
| D2 | API structure | 5 flat entity modules | CQRS/hexagonal layering | "Just CRUD" look — correct for the scale, and the portfolio story is the *boundary*, not internal ceremony |
| D3 | Link semantics | One `LinkingService`, DB constraint as backstop | Logic spread across controllers; DB triggers | Single choke point to keep honest in review |
| D4 | Completion % | Two groupBy queries | Per-set loop; denormalized counter column | Counter column rejected: a cached count that can drift, to optimize a query over hundreds of rows |
| §7 | CI role | Status check only, auto-deploy regardless | CI-gated deploys | A red build can reach prod; solo dev sees it immediately |
