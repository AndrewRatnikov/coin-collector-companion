# Coin Collector Companion — System Design

**Author:** Andrew Ratnikov | **Date:** 2026-07-19 | **Status:** Draft | **Based on:** `prd_v2.md`

## 1. Requirements Recap

**Functional (from PRD):** anonymous catalog + canonical-set browsing; auth-gated collection and set management; set building by filter (year/country/denomination/coin name), by manual pick, or by cloning a canonical set or another user's public set; per-coin owned/not-owned status, settable from any set view but always global to the user; gap list + completion % per set; catalog sourced from open data (Wikipedia/US Mint/Wikimedia Commons) for v1, Numista demoted to optional future enrichment; user-created sets public by default in v1, no per-set privacy control (PRD Requirement 18); no theme/subject tagging in v1 (PRD Requirement 15).

**Non-functional / constraints:** solo developer, few-weeks timeline, must run inside Neon/Render/Vercel free tiers — designed for personal use and small-scale testing, not real multi-tenant load — pnpm monorepo already started (NestJS API, Next.js web, both TypeScript), reuse existing code rather than restart.

**Decisions locked in this pass:**
| Area | Decision |
|---|---|
| Auth | Neon Auth |
| ORM | Prisma (driver adapter for Neon serverless) |
| API style | REST |
| Catalog data source | Open data for v1 — Wikipedia mintage lists / US Mint publications, Wikimedia Commons images. Numista demoted to an optional, permission-gated future enrichment layer (§4.3), not a v1 dependency |
| Catalog sync | Offline, manually-run, resumable/idempotent import script only — no runtime external calls, no scheduled job, no request-time cache-fill (§4.3) |
| Theme/subject tags | Cut from v1 entirely — no `tags`/`coin_tags` tables. Manual pick or cloning another user's set covers the "themed set" use case without them (§4.6) |
| Set visibility | Public by default, no per-set flag in v1 — every `user_set` is viewable and cloneable by anyone (§4.6). `is_public` boolean deferred to post-MVP |
| Grade enum | Scaffolded in `packages/shared` now, unused by any endpoint until v2 |

## 2. High-Level Design

### 2.1 Monorepo structure

The monorepo layout follows the existing workspace structure, with two additions: a `prisma/` folder under `apps/api` (Prisma lives only in the API — the web app never touches the DB directly), and `docs/` explicitly housing the PRD and this design doc so they travel with the code.

```
coin-collector-companion/
├── apps/
│   ├── web/                 # Next.js (App Router) — public browse + authenticated dashboard
│   │   └── src/lib/api-client.ts   # typed fetch wrapper using packages/shared DTOs
│   └── api/                 # NestJS — REST API
│       ├── prisma/
│       │   └── schema.prisma
│       └── src/
│           ├── auth/        # JWT guard, JWKS verification against Neon Auth
│           ├── catalog/     # coin catalog — served from Postgres only, no runtime external calls
│           ├── sets/        # canonical + user sets, gap view
│           └── collection/  # per-user ownership records
├── packages/
│   └── shared/               # DTO shapes (incl. paginated catalog query), enums (denomination, grade [scaffold], mint mark), gap-view response types
├── scripts/
│   └── import-catalog/      # offline, resumable/idempotent catalog import from open sources (see §4.3) — not part of the API's request path
├── seed/
│   └── templates/            # versioned JSON canonical-set definitions (see §4.4)
├── docs/                      # PRD, this design doc, future ADRs
├── package.json
└── pnpm-workspace.yaml
```

### 2.2 Component diagram

```
                     ┌─────────────────────────┐
  Anonymous visitor ─▶  Next.js web (Vercel)   │
  Logged-in user    ─▶  - browse catalog/sets   │
                     │  - dashboard, set editor  │
                     └────────────┬─────────────┘
                                  │ REST (JSON), Bearer JWT when authed
                                  ▼
                     ┌─────────────────────────┐
                     │  NestJS API (Render)     │
                     │  - AuthGuard (JWKS)      │
                     │  - CatalogController     │
                     │  - SetsController        │
                     │  - CollectionController  │
                     └────────┬─────────────────┘
                               │
                   Prisma ORM  │  reads/writes only — no external call in the request path
                               ▼
                     ┌──────────────┐
                     │ Neon Postgres │
                     │ (catalog,     │
                     │ sets, users*, │
                     │ ownership)    │
                     └──────▲───────┘
                            │  offline, manually-run
                            │  import (§4.3) — not
                            │  part of the API service
                     ┌──────┴────────────────┐
                     │ scripts/import-catalog │
                     │ (open sources; Numista │
                     │ optional/future)       │
                     └────────────────────────┘
                               ▲
                     ┌─────────┴─────────┐
                     │ Neon Auth (JWKS,   │
                     │ session, users)    │
                     └────────────────────┘
```
`*` Neon Auth manages its own user table (`neon_auth` schema) alongside the app schema in the same Neon project — no separate identity store to run.

The import script is a standalone offline tool, not a component of the running API service — it's run manually ahead of deploy/seed, writes directly into Postgres via Prisma, and the API never calls out to it or to any external catalog source at request time.

### 2.3 Data flow

**Anonymous browse:** web calls `GET /catalog` or `GET /sets/canonical` with no `Authorization` header. API serves entirely from Postgres, paginated (`page`/`limit`) — there's no cache-miss path, because there's no runtime external source to miss against; a filter that returns nothing genuinely has no matching data yet, not data waiting to be fetched. Catalog population happens ahead of time via the offline import script (§4.3). No write endpoints are reachable without a token.

**Auth:** user logs in via Neon Auth's Next.js SDK on the web app. `authClient.token()` returns a short-lived JWT (15 min, refreshed by the SDK). Web attaches it as `Authorization: Bearer <jwt>` on every write/collection call. NestJS validates the JWT against Neon Auth's JWKS endpoint (EdDSA) in an `AuthGuard` — no session state held by the API itself, so the API stays stateless and horizontally trivial.

**Set building:** `POST /sets` creates an empty set, or clones from a canonical set or from another user's public set (§4.6) — `cloneFrom` accepts either, since both resolve to the same "copy this set's coin list into a new `user_sets` row" operation. `PATCH /sets/:id/coins` adds/removes coin references (filter-matched or manually picked — both resolve to the same "add these coin IDs" operation client-side, so the API only needs one mutation shape).

**Gap tracking:** `PATCH /collection/:coinId` sets owned status for the current user via an explicit `{ owned: boolean }` body — not a toggle, so retries and repeated clicks are safe (idempotent). Ownership itself is existence-based, not a boolean column (§4.1): `owned: true` upserts the `(user_id, coin_id)` row into `ownership`; `owned: false` deletes it if present. Both directions are naturally idempotent — upserting an already-owned coin or deleting an already-absent row is a no-op either way. `GET /sets/:id/gaps` returns the set's coin list left-joined against the user's `ownership` rows, with a computed `ownedCount / totalCount` — "owned" for a given slot is just "a matching row exists," not a flag to read off it.

### 2.4 Storage choice

Single Neon Postgres project. No secondary datastore — at this scale (personal use and small-scale testing), a cache layer like Redis is unnecessary complexity, and there's no runtime external catalog source to cache against in the first place (see §4.3 below). Prisma as the ORM, using `@prisma/adapter-neon` for the serverless driver so connections behave correctly against Neon's pooling on Render.

## 3. API Contracts (REST)

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /catalog` | none | List/filter coins by country, denomination, coin name (text match), year range — paginated (`page`, `limit`) |
| `GET /catalog/:id` | none | Single coin detail |
| `GET /sets/canonical` | none | List canonical sets |
| `GET /sets/canonical/:id` | none | Canonical set detail with coin list |
| `GET /sets/public` | none | List all users' public sets (§4.6) — every `user_set` in v1, since none are private yet — paginated (`page`, `limit`), same as `GET /catalog` |
| `GET /sets/public/:id` | none | Public set detail with coin list (read-only; no ownership/gap data without auth, §4.6) |
| `GET /sets` | required | Current user's sets |
| `POST /sets` | required | Create set — empty, `{ cloneFrom: { type: 'canonical', id } }`, or `{ cloneFrom: { type: 'user', id } }` to clone another user's public set (§4.6) |
| `PATCH /sets/:id` | required | Rename set, edit metadata — owner only |
| `PATCH /sets/:id/coins` | required | Add/remove coin IDs from a set — owner only. Adds append at `max(position) + 1`, skip-on-conflict against `@@unique([<set>Id, coinId])` so re-adding an already-present coin is a no-op, not a duplicate row or an error (§4.1); no mid-set insertion/reordering in MVP |
| `DELETE /sets/:id` | required | Delete a set — owner only. Cascades to its `user_set_coins` join rows only; never touches `ownership` (§4.1) — the coins stay owned everywhere else |
| `GET /sets/:id/gaps` | required | Coins + owned/not-owned status + completion %, computed against the caller's own `ownership` rows — works for the caller's own sets and any public set, not owner-restricted (§4.6) |
| `GET /collection` | required | User's full collection, filterable by country/year |
| `PATCH /collection/:coinId` | required | Set owned status: `{ owned: boolean }` body — idempotent, not a toggle. `true` upserts an `ownership` row, `false` deletes it (§4.1) |

All shapes (request DTOs, `GapViewResponse`, enums) live in `packages/shared` and are imported by both apps — this is the main payoff of the shared package: the web app's TypeScript and the API's DTOs can't drift.

`GET /catalog`'s query DTO (`packages/shared`) includes `page`/`limit` pagination params from the start rather than bolting them on once the table grows — response shape is `{ items, page, limit, total }`. `GET /sets/public` reuses the same DTO/response shape: it's the one other list endpoint that isn't inherently small, since it's every public set from every user, not one user's own — `GET /sets` and `GET /collection` stay unpaginated because those are genuinely per-user and bounded by one person's own activity. `GET /sets/public` has no such bound; it's also unauthenticated, on an app with open signup, making it the one unbounded anonymous query in the API (see §5 for why that matters more than the size of the response). Reusing the already-built pagination DTO here costs nearly nothing and closes that gap rather than leaving it as the sole exception to an otherwise-consistent rule.

For MVP, `name` is a simple case-insensitive substring match against `coins.name` (§4.1) — not full-text search, not fuzzy matching. That's a deliberate v1 scope cut, not an oversight; revisit only if the plain-form filter (§3.1) proves too limiting once real catalog volume is in.

**Route-ordering gotcha in `SetsController`.** `GET /sets/canonical`, `GET /sets/public`, and `GET /sets/:id/gaps` all live under the same `/sets` prefix, and NestJS matches routes in declaration order within a controller — if a handler for `GET /sets/:id` (or `:id/gaps`) is registered above the `canonical`/`public` handlers, a request for `/sets/canonical` gets captured as `:id = "canonical"` instead of hitting the literal route, silently misrouting into the wrong handler rather than failing loudly. Trivially avoided (declare the literal-segment routes — `canonical`, `public` — before the `:id` ones in the controller), but it's exactly the kind of thing that eats the first hour of Week 2 if it's not front-of-mind before writing the controller, not after debugging a confusing 404/403. Pairing `:id` with a validation pipe (`ParseUUIDPipe`, since `user_sets.id`/`canonical_sets.id` are UUIDs per Prisma's default) is worth doing regardless of the ordering fix — it turns "canonical" or "public" leaking into `:id` (if the ordering mistake ever does happen, e.g. after a future route is added carelessly) into a loud 400 instead of a confusing 404 that looks like a missing-set bug rather than a routing bug.

### 3.1 Frontend routes (Next.js App Router)

| Route | Auth | Purpose |
|---|---|---|
| `/` | none | Landing / catalog entry |
| `/catalog` | none | Browse/filter coin catalog |
| `/catalog/[coinId]` | none | Coin detail |
| `/sets/canonical` | none | Browse canonical sets |
| `/sets/canonical/[id]` | none | Canonical set detail (with "clone" CTA if logged in) |
| `/sets/public` | none | Browse public sets created by other users (§4.6) |
| `/sets/public/[id]` | none | Public set detail (with "clone" CTA if logged in; shows the caller's own owned/missing status against the set's coins if logged in, §4.6) |
| `/login`, `/signup` | none | Neon Auth flows |
| `/dashboard` | required | User's sets overview |
| `/collection` | required | Full collection, filterable by country/year |
| `/sets/[id]` | required | Set editor + gap view (owner only for editing) |
| `/sets/new` | required | Create set (blank, or clone-based from a canonical or public set) |

**Catalog search, MVP:** `/catalog`, and the same filter UI reused inside `/sets/new`/`/sets/[id]`'s coin picker, is a plain form — fields for country, denomination, and coin name (free-text, matched against `coins.name`), plus year range. Not a live/autocomplete/faceted search — every filter change requires an explicit submit, matching `GET /catalog`'s query-param shape (§3) directly with no client-side search-as-you-type layer to build for v1.

**Coin display name, MVP:** `{country} {denomination} ({year} {mintMark})`, e.g. `USA 1 Cent (1984 D)` — when `mint_mark` is empty (`''`, §4.1), the parenthetical drops to just the year, e.g. `USA 1 Cent (1984)`. This is a computed label, not a stored column, and is distinct from `coins.name` (§4.1): `name` holds the catalog series/type name (e.g. "Lincoln Wheat Cent") used for search filtering above, while this format is what's actually rendered wherever a coin appears as a compact label — catalog list rows, the coin detail header, the set editor's coin picker, and gap-view slot cards. One formatter, in `packages/shared`, so both apps render it identically.

User sets are snapshots containing explicit coin references; filters are only used during creation and editing and are not stored as dynamic queries. `/sets/new` and the editor on `/sets/[id]` use the catalog filter form above purely as a client-side picking tool — each filter result the user adds resolves immediately to a coin ID written into `user_set_coins` (§4.1). Once added, a set's contents are fixed until the user edits them again; nothing about a set's membership re-evaluates automatically if the underlying catalog changes later (e.g. a new coin added to the catalog for "1980–2020 US cents" doesn't retroactively appear in a set someone already built against that range).

Route protection sits in Next.js middleware: it checks the Neon Auth session and redirects unauthenticated users hitting `/dashboard`, `/collection`, or `/sets/*` (excluding `/sets/canonical`, `/sets/public`, and `/sets/public/[id]` — all read-only and anonymous per §4.6) to `/login`. This mirrors the API's own anon/auth split (§3) — the middleware is a UX convenience (redirect before render), not a security boundary; the API's `AuthGuard` is the actual enforcement point since routes alone can't stop a direct API call.

## 4. Deep Dive

### 4.1 Data model

```
coins
  id (pk), numista_type_id (nullable, NOT unique — enrichment attribute, not identity),
  country, denomination, year, mint_mark (NOT NULL, default ''), variety (NOT NULL, default ''),
  name (e.g. "Lincoln Wheat Cent", "Morgan Dollar" — populated by the import script from
  source data, used by the MVP catalog search form, §3.1; no index — the substring match
  below (§3) seq-scans regardless of a plain b-tree index, and that's fine at catalog scale),
  image_url (nullable), image_source (nullable), image_license (nullable),
  created_at, updated_at
  @@unique([country, denomination, year, mintMark, variety])

canonical_sets
  id (pk), name, description, source ("admin" | "seed-template"), template_version

canonical_set_coins  (join: canonical_sets ↔ coins; position (int) — explicit sort order)
                     @@unique([canonicalSetId, coinId])

user_sets
  id (pk), user_id (Neon Auth user id), name,
  cloned_from_canonical_id (nullable, onDelete: SetNull),
  cloned_from_user_set_id (nullable, onDelete: SetNull),
  created_at, updated_at

user_set_coins       (join: user_sets ↔ coins; position (int) — explicit sort order;
                      onDelete: Cascade on user_set_id — deleting a user_set cleans up
                      only its own join rows, see notes below)
                     @@unique([userSetId, coinId])

ownership
  user_id, coin_id (composite pk), owned_at
```

Notes:
- `numista_id` is renamed `numista_type_id` and dropped as a unique column — a single Numista "type" spans many mint years, so uniqueness can never live on that column alone, and it's an enrichment attribute (an optional cross-reference), not part of a coin's identity. Per-coin uniqueness instead lives on the composite `(country, denomination, year, mint_mark, variety)` — the same natural key the import script already dedupes on (§4.3), now backed by a real DB constraint rather than depending entirely on the script getting it right. Putting `numista_type_id` in that composite instead (an earlier draft of this doc did) would have been a bug: v1's coins are all open-source-sourced with `numista_type_id = NULL`, and Postgres doesn't treat `NULL`s as equal in a unique constraint, so that version of the constraint would silently protect zero rows in v1 — any bug in the import script's own dedup logic would produce duplicate coins with no database backstop, and duplicates corrupt gap counts and completion percentages downstream. A future Numista backfill just sets `numista_type_id` on rows that already exist uniquely by natural key; it needs no constraint of its own.
- `mint_mark` and `variety` are `NOT NULL` with `''` as the default, not nullable — a nullable column in the natural-key composite above would reopen the same hole (Postgres doesn't treat `NULL`s as equal, so multiple "no mint mark" rows for the same coin wouldn't collide and dedup would silently fail). Empty string is the Prisma-schema-expressible way to get real uniqueness here; Postgres 15+'s `UNIQUE NULLS NOT DISTINCT` would be the more semantically honest fix but isn't expressible in Prisma's schema language, so `''`-as-default is the pragmatic choice. This is purely a catalog (`coins`) modeling detail — it doesn't change the app-facing mint-mark convention already locked in for `CoinItem`/`SetSlot` in the CLAUDE.md project log (`null`, never `"P"`), which is a different table in a different part of the schema.
  - **Gotcha the constraint doesn't protect against:** the `NOT NULL DEFAULT ''` only closes the `NULL` hole — it does nothing if the import script (§4.3) writes a *different* placeholder for "no mint mark" than the DB default, e.g. Prisma seeing a literal `null`/`undefined` from a scraped field (which Prisma would reject outright, good) versus a stray string like `"None"`, `"N/A"`, or `" "` slipping through from inconsistent source formatting (which Prisma would happily write, bad). Two rows meaning the same "no mint mark" but stored as `''` and `"None"` don't collide on the unique constraint at all — they look like two distinct coins, and the failure is silent (no error, just a duplicate in the catalog corrupting downstream gap/completion counts). The fix lives in the import script, not the schema: explicitly normalize every mint-mark/variety value to `''` for any of `null`/`undefined`/empty-ish placeholder *before* the value reaches Prisma, so `''` is the only representation of "none" that ever hits the DB.
- `canonical_set_coins` and `user_set_coins` both carry a `@@unique([<set>Id, coinId])` constraint — without it, nothing stops the same `coin_id` from appearing twice in one set's coin list: a double-click on "add," a retried `PATCH /sets/:id/coins` request, or re-submitting a filter selection that overlaps a previous one would each silently insert a duplicate row. That inflates `totalCount` and corrupts the set's completion % — the exact class of downstream corruption the catalog-level natural-key constraint (above) was built to prevent, just one join-table over. `PATCH /sets/:id/coins`'s add operation is written as skip-on-conflict against this constraint (Prisma `createMany({ skipDuplicates: true })` or an upsert, depending on what else the row needs to carry) rather than a plain insert — which also makes re-adding a coin that's already in the set a no-op instead of an error, matching the idempotent-write ethos already applied to `PATCH /collection/:coinId` (§4.1's ownership notes) rather than introducing a different failure mode here.
- `canonical_set_coins` and `user_set_coins` both carry an explicit `position` column — the design doc's earlier "(ordered)" annotation didn't say how; this is how "ordered" is actually enforced (sort by `position`, not insertion order, which Postgres doesn't guarantee to preserve). No `@@unique` on `(<set>Id, position)` — MVP's append-only assignment (below) can't produce a *position* collision (skip-on-conflict above prevents the *coin_id* collision that would otherwise force one), so there's nothing for a DB constraint to guard against yet.
  - **MVP position assignment: append-only, no mid-set insertion.** Cloning a canonical or public set copies the source's positions verbatim (§4.4, §4.6) — the clone starts pre-ordered. From there, `PATCH /sets/:id/coins` (§3) assigns every newly-added coin `max(position) + 1` within that set (or `1` if the set is empty); it never re-indexes existing rows to make room for a mid-set insert. Removing a coin leaves a gap in the sequence rather than renumbering what's left — harmless, since `position` only needs to sort correctly, not be contiguous. Drag-and-drop reordering into an arbitrary position is out of scope for MVP specifically to avoid the re-indexing problem that would otherwise require: reordering N items either means writing N rows in a transaction or moving to a fractional/float position scheme, neither of which is worth building before the append-only version is validated in use (see §7).
- `ownership` is scoped to `(user_id, coin_id)`, not to a set — a coin marked owned is owned globally for that user, and every set the coin appears in reflects it. This matches PRD requirements 12–13 (a set's owned/not-owned toggle updates ownership globally, not per-set) and requirement 5 (view full collection independent of any one set), and avoids duplicate/contradictory ownership state per set.
  - **This also means `ownership` has no relationship to `user_sets`/`user_set_coins` at all** — no FK in either direction, joined only incidentally through `coin_id` at query time (§2.3, §4.6). `DELETE /sets/:id` (§3) deletes the `user_sets` row and cascades to its `user_set_coins` join rows only — there is no FK path from there to `ownership`, so it structurally cannot cascade into it. This is worth stating explicitly anyway, not just relying on the schema being correct by construction: it would be an easy application-layer mistake to write a "delete this set and everything about the coins in it" handler that also strips `ownership` rows for those coins, and that would be wrong — a coin stays owned (and shows up correctly in `GET /collection` and any *other* set it belongs to) even after the one set it was tracked against gets deleted, per PRD requirement 5.
- No `tags`/`coin_tags` tables in v1 — theme/subject tagging is cut entirely, not just deferred (PRD Requirement 15 and Risks). The "themed set" use case is still reachable in v1 via manual pick or by cloning another user's public set (§4.6), just not via a tag filter.
- `user_sets` has no `is_public` column in v1 — every row is implicitly public (§4.6). `cloned_from_canonical_id` and `cloned_from_user_set_id` are both nullable and mutually exclusive (a set clones from at most one source, or neither if built from scratch); neither is enforced by a DB constraint since it's a low-stakes invariant the API layer already guarantees by construction (`POST /sets` only ever sets one or the other).
  - **Both FKs are `onDelete: SetNull`, explicitly, not left at whatever Prisma defaults to.** `cloned_from_user_set_id` self-references `user_sets` — if that were `Cascade` instead, deleting one popular public set would silently delete every clone anyone else ever made of it, which is exactly the kind of "meant to remove *my* stuff, actually removed *someone else's*" corruption this doc has been guarding against everywhere else (the `ownership`-on-set-delete note above, the dedup constraints on the join tables). `SetNull` is what a clone being "fully independent" once made (§4.4, §4.6) actually requires structurally: the clone survives, `cloned_from_user_set_id` just goes back to `null`, same outcome as if it had been built from scratch. `cloned_from_canonical_id` gets the same treatment for the same reason, even though canonical sets aren't user-deletable in v1 — no code path currently exercises it, but there's no reason to leave it as an unstated default when the correct value is cheap to write down and the wrong one is catastrophic and silent.
- **Ownership is existence-based, not a boolean column.** There is no `owned` flag anywhere in this table — owned = a `(user_id, coin_id)` row exists; not owned = no row. `owned_at` is metadata on that row (when it was marked owned), not a status field. This is why `PATCH /collection/:coinId`'s `{ owned: boolean }` body (§3) maps to an upsert-or-delete rather than a column write: `true` → upsert the row; `false` → delete it. It also means "not owned" needs no query-side `owned = false` filter — it falls out of a plain `LEFT JOIN`/anti-join against `ownership` returning no match, which is exactly how `GET /sets/:id/gaps` (§2.3) computes gaps already.
- `variety`/`mint_mark` are plain columns, not a separate table — no extra join needed unless the data later shows meaningful variation within a single catalog coin.
- `image_source`/`image_license` are recorded per coin, not assumed globally — see §4.3 for why (Wikimedia Commons hosts images under more than one license, and only some are usable without per-image attribution UI). Both nullable since not every coin will have a usable image.
- `grade` enum exists in `packages/shared` as a deliberate scaffold, but no `grade` column is added to `ownership` yet — nothing references it until v2, so there's no dead schema to migrate around later.

### 4.2 Auth flow (Neon Auth)

1. User signs in on `apps/web` via Neon Auth's SDK (Stack Auth under the hood).
2. Web calls `authClient.token()` before each authenticated API request, attaches as Bearer token.
3. NestJS `AuthGuard` fetches (and caches in-memory, short TTL) the JWKS from Neon Auth's endpoint, verifies signature (EdDSA) and issuer, extracts `user_id`.
4. Anonymous routes skip the guard entirely — no token means no `user_id`, and the controller simply doesn't scope the query.

This keeps the API stateless: no server-side sessions, nothing to share across Render instances if the deployment ever scales beyond one.

### 4.3 Catalog import (offline, scoped, from open sources)

No runtime external calls, no `sync_log`, no filter-hash dedup. The catalog is populated entirely ahead of time by a manually-run offline script, and `GET /catalog` only ever reads Postgres.

**v1 source (primary):** open data — Wikipedia mintage lists / US Mint publications for U.S. coin data, Wikimedia Commons for images. No API key, no rate limit, no ToS extraction restriction to navigate for v1.

Image licensing needs per-image handling, not a blanket assumption: U.S. Mint images on Commons are public domain, but Commons also hosts user-photographed coin images under CC BY-SA and similar share-alike licenses that carry an attribution obligation. Two safeguards, both cheap: (1) the import script only pulls images tagged public domain or a license the app can satisfy without per-image UI attribution, and records `image_source`/`image_license` per coin row rather than assuming one blanket license for everything imported; (2) regardless, add a one-line attribution note in the app footer covering Wikipedia-derived catalog data generally (CC BY-SA), since that's a one-sentence cost that removes the question entirely rather than requiring the import script to get every edge case right.

**Image storage, MVP: hotlink, don't host.** `coins.image_url` stores the source's own public URL (Commons, in v1) directly — the import script never downloads and re-hosts the image bytes. This keeps v1 simple (no object storage, no upload pipeline, nothing to provision beyond Postgres) and is a deliberate scope cut, not an oversight — and safer than a generic hotlinking decision would be: Wikimedia explicitly permits hotlinking images served from `upload.wikimedia.org` (unlike most sites, where hotlinking risks getting blocked or rate-limited), so the residual risk here is narrower than "the source might cut us off" — it's really just files occasionally being renamed, moved, or deleted on Commons (a collector re-uploads a better scan under a new filename, a low-quality image gets superseded, etc.), not a hostility risk. Revisit self-hosting (e.g. downloading into Cloudflare R2 at import time, `coins.image_url` pointing at the app's own storage instead) once *that* narrower problem is actually showing up in practice — broken/moved links surfacing as 404s — or simply once MVP is out the door and this becomes a polish item, not preemptively and not because Commons is expected to ever block the traffic. This is a distinct concern from the existing Phase 3 image-storage work noted in `CLAUDE.md` for user-uploaded `CoinItem.imageUrls`; that's user photos of coins they own, this is catalog reference images, and the two may end up sharing infrastructure later but don't need to now.

```
scripts/import-catalog  (run manually, ahead of deploy — not request-time, not a scheduled job)
  → reads/parses the chosen open source(s) for a given denomination/country scope
  → normalizes into the coins schema (country, year, denomination, mint_mark, variety,
    image_url, image_source, image_license)
  → sanitizes mint_mark/variety specifically: any of null, undefined, or a source-specific
    "none" placeholder ("None", "N/A", whitespace, etc.) is coerced to the literal '' before
    the value reaches Prisma — the DB's NOT NULL DEFAULT '' constraint (§4.1) only dedupes
    correctly if '' is the *only* representation of "no mint mark" that ever gets written;
    a stray alternate placeholder slipping through defeats the unique constraint silently
  → skips (or fetches without image_url) any image whose license the app can't satisfy —
    public-domain-tagged only for v1, not "whatever Commons returns for a search"
  → upserts into Postgres, deduped on the natural key (country, denomination, year, mint_mark, variety)
  → resumable: safe to stop and re-run partway through; idempotent: re-running a
    completed scope is a no-op, matching the same "upsert on natural key" pattern
    already used for seed templates (§4.4)
```

**Numista: optional, permission-gated, future enrichment only — not a v1 dependency.** If pursued later to backfill `numista_type_id` or fill gaps the open sources don't cover:
1. Email contact@numista.com for permission first — their ToS prohibits substantial extraction of the database, and this isn't optional groundwork to skip.
2. Scope any import by country + denomination, never whole countries — start with US cents, on the order of 50–100 requests.
3. The import script must be resumable and idempotent (same requirement as above) so a re-run after a failure or a quota limit doesn't waste requests re-fetching what already succeeded.
4. Check OpenNumismat's downloadable SQLite catalogs first as a possible ready-made seed (email the author about non-private use before relying on it) — it may cover the gap without spending Numista quota at all.

**No theme/subject tags in v1 — cut entirely, not hand-tagged.** An earlier draft of this doc had the import script or canonical-set authoring hand-tag coins by theme; that's dropped along with the `tags`/`coin_tags` tables (§4.1, PRD Requirement 15). None of the open sources carry subject metadata, and a "themed set" is still buildable in v1 without it — manual pick, or cloning another user's already-themed public set (§4.6). Wikidata's "depicts" property remains a plausible automated source if tagging is reintroduced post-MVP.

Failure handling: the import script fails loudly and stops rather than partially importing — safe to do because it's resumable (above), so a failed run costs re-running from where it stopped, not a corrupted partial catalog. There's no live request-path fallback to design for, because there's no live request-path call at all.

### 4.4 Canonical sets & seed templates

Canonical sets are defined as versioned JSON templates under `seed/templates` (PRD requirement 17); this section specifies how those templates are structured and loaded.

- Each canonical set is one JSON file: `seed/templates/us-presidents.v1.json`, containing the set's name, description, and either a static list of coin natural-key references (`country`/`denomination`/`year`/`mint_mark`/`variety`, or a `numista_type_id` where one happens to exist) or a filter definition (e.g. "all US cents 1909–1958") resolved against the already-imported catalog — never against a live external call, since by the time this script runs, `scripts/import-catalog` (§4.3) has already populated Postgres.
- The version suffix (`.v1`) matters because canonical sets can be corrected or expanded later without silently changing a set that users already cloned into their own collection — `canonical_sets.template_version` records which template version a given canonical set row came from.
- A one-off admin script (`apps/api` CLI command, run manually — not scheduled) reads every file in `seed/templates/`, resolves each entry against the catalog already in Postgres, and upserts into `canonical_sets` + `canonical_set_coins` (setting `position` per §4.1, skip-on-conflict against `canonical_set_coins`' `@@unique([canonicalSetId, coinId])` — a template author accidentally listing the same coin twice, or re-running the script after a partial failure, produces one row, not a duplicate slot). This runs strictly after the catalog import (§4.3), not instead of it.
- Once a user clones a canonical set into `user_sets`, it's a fully independent copy — editing it never touches the canonical template or other users' clones.
- Per the PRD's descope guidance: if the general seed-template pipeline runs short on time, fall back to one hardcoded canonical set inserted directly (skipping the general-purpose JSON-driven script) rather than dropping canonical sets — they're required by the success metric.

### 4.5 Error handling & retries

- Catalog import script (§4.3): single retry with backoff on transient network errors when pulling from the open-source site/dataset, then stop and report — no partial-import fallback needed, since re-running is safe by design (resumable/idempotent). No live request-path Numista/network dependency exists to retry against at request time.
- Auth: JWKS fetch failures fall back to the last successfully cached key set for a short grace window rather than hard-failing every request if Neon Auth has a transient blip.
- Set/collection mutations are simple single-row Postgres writes — no distributed transaction concerns at this scale.

### 4.6 Set visibility & sharing (public by default)

Every `user_set` is public in v1 — there's no `is_public` column and no permission check gating *read* access to another user's set (PRD Requirement 18). What's still owner-restricted is *writing*: `PATCH /sets/:id`, `PATCH /sets/:id/coins`, and `DELETE /sets/:id` keep the existing ownership check (404 unknown, 403 foreign — the same two-tier pattern used elsewhere in this codebase), since "public" means viewable and cloneable, not editable by anyone but the owner.

**Discovery:** `GET /sets/public` lists every `user_sets` row across all users (no auth required), paginated (`page`/`limit`, §3) — in v1 this is literally "all user sets," since none are private yet; once `is_public` ships post-MVP this becomes `WHERE is_public = true` and the endpoint's contract doesn't change. `GET /sets/public/:id` returns one set's detail and coin list, also unauthenticated. Neither endpoint exposes anything beyond the set itself — no owner display name, profile link, or other user-identifying detail, since public profiles are explicitly out of scope (PRD Non-Goals) and the set data alone is enough to support browsing and cloning.

**Cloning:** `POST /sets`'s `cloneFrom` (§3) accepts a canonical set or a public user set, both resolving to the same operation — copy the source's ordered coin list into a new `user_sets` row owned by the caller, recording `cloned_from_canonical_id` or `cloned_from_user_set_id` accordingly (§4.1). Once cloned, the copy is fully independent (same rule already established for canonical-set clones, §4.4) — editing it never touches the original, whoever owns it. That independence also holds if the original is later *deleted*: both lineage FKs are `onDelete: SetNull` (§4.1), so the clone survives with `cloned_from_user_set_id` reset to `null` rather than being pulled down with its source.

**Gap view on a set you don't own:** `GET /sets/:id/gaps` is not owner-restricted — a logged-in caller can request gaps for any public set, not just their own, and the response is computed against *the caller's own* `ownership` rows (§4.1's existence-based model makes this natural: the query just left-joins the requested set's `user_set_coins` against `ownership WHERE user_id = <caller>`, regardless of who owns the set). This means a user can browse someone else's public set and immediately see how many of its coins they personally already own, before deciding whether to clone it — a natural side effect of ownership being global-per-user rather than per-set, not a special case that needed separate design. Anonymous callers don't get this (no `user_id` to join against) — they see the plain coin list via `GET /sets/public/:id` only, consistent with anonymous access being read-only everywhere else in the app (PRD reqs 1–2).

**Post-MVP: `is_public` flag.** Add `is_public boolean NOT NULL DEFAULT true` to `user_sets` via a normal migration — the default preserves current (all-public) behavior for every existing row, so this ships without a backfill or a breaking change. `GET /sets/public`/`GET /sets/public/:id` add an `is_public = true` filter/check; `GET /sets/:id/gaps` and cloning gain a visibility check alongside the existing ownership check (owner OR `is_public`). Deliberately not built now — it's a permission check with no real payoff at v1's target scale (personal use and small-scale testing, effectively one real user), so it's cut rather than half-built.

## 5. Scale & Reliability

**Load estimate:** designed for personal use and small-scale testing, not real multi-tenant load — 1 real user today, with informal headroom for a handful of testers. At that scale, request volume is trivially low (dozens of requests/user/session) — none of Neon/Render/Vercel free-tier limits are a realistic constraint.

**"Effectively single-user" is an assumption about who shows up, not something the app enforces.** Registration is open (PRD requirement 3 — anyone can create an account, no invite/approval gate), sets are public by default (§4.6), and there's no rate limiting anywhere (§7). Nothing in the app actually stops a stranger from finding it, registering, and hammering `GET /sets/public` or `POST /sets` in a loop; the "small-scale testing" framing describes the expected traffic, not a guarantee about it. That's an acceptable v1 trade — building rate limiting for load that isn't expected to materialize is exactly the kind of preemptive work this doc has avoided elsewhere (§6) — but it's worth being conscious of specifically at the moment of deploying publicly (Build Roadmap buffer week), since "designed for personal use" quietly stops being true the instant the URL is public and reachable by anyone, not just at some later point when a user count crosses a threshold.

**Known free-tier friction:**
- Render free web services spin down after inactivity — first request after idle will be slow (cold start, several seconds). Acceptable for a personal/demo tool; would need a paid instance or a keep-alive ping to fix for real traffic.
- Neon's free tier autosuspends compute after inactivity — same cold-start effect on first query, independent of Render's.
- Vercel free tier has no meaningful constraint at this scale.

**Failover:** none needed at this scale — single region, single instance of each service is appropriate. Not worth adding redundancy before there's real multi-user load.

**Monitoring:** Render and Vercel's built-in logs/dashboards are sufficient for v1. No need for a dedicated observability stack yet.

## 6. Trade-off Analysis

| Decision | Chosen | Alternative | Why |
|---|---|---|---|
| Auth | Neon Auth | Email/password via Auth.js | Already inside the Neon project, JWKS-based verification is a clean fit for a separate NestJS backend, no extra service to run or secrets to manage |
| ORM | Prisma | Drizzle | Better-known by hiring managers reviewing a portfolio project, mature NestJS integration patterns, migrations are simpler to reason about solo. Drizzle's lighter runtime isn't a meaningful win at this scale — worth revisiting only if cold-start latency from Prisma's engine becomes noticeable |
| API style | REST | GraphQL | Domain is resource-shaped (catalog, sets, collection) with no deep nested-query needs; GraphQL's flexibility isn't earning its complexity here |
| Catalog data source | Open data (Wikipedia/US Mint/Wikimedia Commons) | Numista API | Free, no ToS extraction restriction, no per-request quota to manage for v1; Numista remains available later as a permission-gated enrichment layer once genuinely needed, not blocked on, just deferred |
| Catalog sync | Manual, offline, resumable import script | Scheduled bulk import / on-demand fetch + cache | Avoids needing a persistent worker process, which free-tier Render doesn't comfortably support, and avoids any runtime dependency on an external source at all — the catalog is either in Postgres or it isn't, with no cache-invalidation question to design for |
| Ownership scope | Per-user, global (not per-set) | Per-set ownership records | Matches the PRD's "view full collection" requirement directly and avoids the same coin having contradictory owned/not-owned states across sets |
| Grade field | Scaffolded, unused | Omitted entirely | Costs nothing to type now, saves a schema migration later; explicitly not wired into any endpoint so it can't leak into v1 behavior |
| Theme/subject tags | Cut from v1 entirely | Hand-tagged in canonical sets only | No free source covers it well, and it's not on either Success Metrics path (filter-built or canonical-set-derived); the "themed set" use case is still reachable via manual pick or cloning a public set (§4.6), so nothing is actually lost |
| Set visibility | Public by default, no per-set flag | `is_public` flag from day one | A flag with no way to ever be `false` in practice (single real user, no other users to hide a set from yet) is schema/UI cost with zero v1 payoff; the migration to add it later is additive and non-breaking (§4.6), so nothing is lost by deferring it |
| Set-editor position assignment | Append-only (`max(position) + 1`) | Full drag-and-drop reordering | Avoids a re-indexing transaction (or a fractional-position scheme) for a feature no one's validated wanting yet; a user can still fully control final order by building the set in the order they want, just not by reordering after the fact |

## 7. What to Revisit as It Grows

- **Catalog breadth:** if the open-source data proves too thin (missing denominations/countries), pursue Numista as an enrichment layer following the permission-gated process in §4.3 — email first, scope by country + denomination, resumable/idempotent script — rather than reaching for it reflexively.
- **Theme/subject tags:** reintroduce `tags`/`coin_tags` (§4.1) if theme-based browsing proves worth the schema/UI cost — Wikidata's "depicts" property is a plausible automated source at that point, rather than hand-tagging from scratch.
- **Set visibility:** ship the `is_public` flag (§4.6) once there's more than one real user and someone actually wants a private set — an additive, non-breaking migration, not a redesign.
- **Set-editor reordering:** if users actually want to reorder coins mid-set (not just append), add either a bulk re-index endpoint (rewrite all affected `position` values in one transaction — fine at v1's per-set row counts) or switch to fractional positions (insert between two existing values without touching anything else — worth it only if sets get large enough that a full re-index becomes noticeably slow). Don't build either preemptively (§6).
- **Image hosting:** move off hotlinking Commons URLs (§4.3) and start downloading images into the app's own storage (e.g. Cloudflare R2, matching the storage choice already used for Phase 3 user-uploaded photos) once it's an actual problem, not on a schedule. The realistic trigger here is narrower than for a typical hotlinking decision — Wikimedia explicitly permits hotlinking from `upload.wikimedia.org`, so "Commons blocks our traffic" isn't a signal to watch for; what's actually worth watching is source links going stale/404ing as files get renamed or moved on Commons over time, or simply reaching the MVP-is-shipped polish phase where the trade-off is worth revisiting anyway.
- **Catalog sync mechanism:** if the catalog needs to update more often than "occasionally re-run the import script by hand" (e.g. once real-time Numista enrichment is in play), revisit moving to a scheduled job — only relevant once Render is on a paid tier that can run a persistent worker/cron, since free-tier Render doesn't support one.
- **Ownership model:** if duplicate tracking or per-set condition/grade ever comes in (both explicit non-goals today), the `ownership` table will need a redesign — likely moving from a `(user_id, coin_id)` composite key to a proper `ownership_id` with a quantity column, since the current existence-based model (§4.1: owned = row exists, not owned = row absent) can't represent "I own two of these."
- **Auth:** if the app opens to real multi-tenant usage, revisit rate limiting and abuse protection on write endpoints — none is in place for v1 since it's effectively single-user.
- **Premium tier:** noted in the PRD as future-only; once it's real, it likely needs its own billing-state table and a plan-gating check in the API guards, not a redesign of the core data model above.