# Coin Collector Companion — PRD (v1.1)

**Author:** you · **Status:** draft · **Type:** personal pet project (real use + portfolio piece)

**Changes from v1.0 (validation pass):** (1) `denomination` is now a shared enum carried on `CollectionSet` — v1.0's auto-suggest match key referenced a denomination that existed nowhere on the set side, making the match unimplementable as specced. (2) The seed script upserts slots on a natural key instead of replacing them wholesale — wholesale replacement would have nulled every user's slot links on each template correction. (3) Mint-mark convention decided: no-mark issues (e.g. pre-2017 Philadelphia cents) store `null`, never `"P"`. (4) Added: transactional relink requirement, JWT storage + CORS decision, auth rate limiting, `DELETE /user-sets/:id`, USD-only pricing decision, password reset explicitly a non-goal. No product decisions changed.

**Changes from high-level PRD v0.2:** superseded that document. This version keeps every decision already made (phasing, two-state slots, duplicates rule, Prisma, Neon over Supabase, cold-start acceptance) and adds implementation-level detail: full data model with field types and constraints, a Prisma schema sketch, a per-phase API surface, screen-by-screen UI breakdowns, validation/error rules, and expanded edge cases. No product decisions changed — this is the same plan, specced deeper.

---

## 1. Problem & Motivation

Existing coin-collecting apps show *what you own* but not *what you're missing*. Serious collectors don't build a collection one coin at a time — they build it against a **set** (e.g. "Lincoln Wheat Cents 1909–1958, all mints"). The useful question isn't "show me my coins," it's **"what do I still need to complete this set, and how close am I?"**

That's the wedge. Everything else in the app (adding coins, photos, values) is table stakes every competitor already has. The gap view is the reason this app exists.

## 2. Goals / Non-Goals

**Goals**

- Ship a genuinely usable Phase 1 in about a week; a polished, demoable app by end of Phase 2.
- Solve the one problem existing apps don't: gap visibility against a set.
- Use it yourself for your real collection (dogfooding keeps scope honest).
- Demonstrate full-stack range for job search: separate FE/BE services, real data modeling, auth, and (in Phase 3) file uploads — not just CRUD-over-a-table.

**Non-goals (for now)**

- Not a price guide / marketplace (no live pricing feeds, no buy/sell).
- Not covering every numismatic category on day one (world coins, ancients, tokens — later).
- No social features.
- No coin authentication / grading-by-photo.
- **No password reset / account recovery.** It drags in email-sending infrastructure (provider, templates, token flow) for a personal-scale app. Excluded deliberately — this is a decision, not an oversight. If the app ever gets real third-party users, it's the first thing to add.
- **No photos until Phase 3.** Photos matter to collectors, but the gap view — the entire point of v1 — doesn't need them. Deferring uploads removes the single most time-consuming piece of infrastructure (object storage, presigned URLs, cleanup) from the critical path.

## 3. Target User

Primarily **you** — a collector who's tried existing apps and bounced off them. Secondary: any collector who thinks in terms of "completing a set" rather than just logging items (this covers most series collectors: cents, quarters, silver dollars, etc.).

**Primary persona detail:** owns 100–500 coins across 2–5 series, already knows which sets they're chasing, wants completion status at a glance rather than a spreadsheet. Not a dealer, not managing inventory for resale — collection size and usage pattern stay personal-scale (this is why search is a filter bar in Phase 2, not a search engine, and why the dashboard is deliberately thin).

## 4. Core Differentiator: The Gap View

A **Set** is a canonical checklist of expected coins (e.g., every year+mint-mark combination in a series). A **Collection** is what the user actually owns. The gap view is the diff between the two, per set.

### 4.1 States and display

- Every slot renders in exactly one of **two states**: `owned` (has a linked `CoinItem`) or `missing` (no link). No third state in v1 — "owned but wanted in better condition" is an upgrade flag that belongs with the want-list feature in Phase 4; modeling it now would smuggle a want-list into v1 through the back door.
- Slots render in a grid (grouped by decade or by mint mark, whichever the set's `sortOrder` implies) or a flat list — grid for sets with a regular year × mint structure (Lincoln Cents), list for irregular ones (a custom set with hand-picked slots).
- Each slot shows: year, mint mark, owned/missing state (color + icon, not color alone — accessibility), and a key-date badge (⭐ or similar) if `isKeyDate` is true and the slot is missing. Key-date badges on *owned* slots are muted/secondary — the badge's job is to flag hard gaps, not to celebrate hard wins.
- Header for the set shows: set name, category, completion % (`ownedCount / totalSlots`, rounded to nearest integer), and a raw count ("38 / 96 owned").
- Clicking/tapping a missing slot opens the "link a coin" flow (manual search across the user's `CoinItem`s, or "add new coin" pre-filled with that slot's year/mint). Clicking an owned slot shows the linked coin's detail with an "unlink" action.

### 4.2 Auto-suggest (keeps the gap view truthful)

The gap view is only accurate if users actually link coins to slots, and manual linking is tedious enough that people skip it. So when a coin is added or edited, the app auto-suggests matching open slots:

- **Match key:** denomination + year + mint mark, evaluated against open (unlinked) slots across all of the user's active (`UserSet`) sets. Denomination lives on the *set* (`CollectionSet.denomination`, a shared enum — see §6.3), so the comparison is `slot.set.denomination === coin.denomination && slot.year === coin.year && slot.mintMark === coin.mintMark`. All three fields are enum/int/normalized — no free-text comparison anywhere in the match, or it silently stops matching ("penny" ≠ "cent").
- **Mint-mark normalization:** coins struck with no mint mark are stored as `mintMark = null` on both slots and coins — never `"P"` (see §6.3). The match is exact: `null` matches `null`, `"D"` matches `"D"`. Without this convention the most common coins in most US series (Philadelphia issues) would never match their slots.
- **Zero matches:** no suggestion shown, coin is saved unlinked.
- **One match:** shown as a one-tap confirm ("Link to Lincoln Cents 1955-D?" → Confirm / Dismiss). Dismiss just leaves the coin unlinked; it doesn't blacklist the suggestion from reappearing on next edit.
- **Multiple matches** (e.g., the same year/mint slot exists in two active sets, or the set has two slots that both nominally fit — see edge cases below): show all candidates, user picks one or none.
- Auto-suggest runs again on coin *edit* if denomination/year/mint changed, using the same logic.
- This ships in **Phase 1**, not later — it's what keeps the gap view trustworthy, not a nice-to-have.

### 4.3 Edge cases

- **Slot already filled, new coin also matches:** auto-suggest still offers it (labeled "Replace current link"); confirming unlinks the old coin (which stays in the collection, unlinked) and links the new one. The unlink+link pair runs in a single transaction (see §9) — done as two independent writes, the `(userId, slotId)` unique constraint rejects the second write.
- **Variety slots guarantee the multi-candidate picker fires:** any set with two slots sharing year+mint (e.g. Lincoln Cents has both 1909-S and 1909-S VDB) makes every matching coin a multi-candidate case. This is a *routine* path, not an edge case — build the multi-candidate UI accordingly, don't treat it as a rare fallback.
- **Coin matches a slot in a set the user isn't pursuing (no `UserSet` row):** not suggested — auto-suggest only considers sets the user has activated.
- **Set has no key dates defined:** key-date badge logic simply never fires; not a special case in code, just an empty `isKeyDate` set.
- **All slots missing (freshly activated set):** completion % shows 0%, no empty-state trickery needed — the grid itself communicates "you have nothing yet."
- **Set fully complete:** show a distinct completed treatment (e.g., a "Complete ✓" badge in the header) — small but worth the polish since it's a satisfying moment for the core feature.

## 5. Phased Scope

The high-level PRD's original trap was calling everything "MVP." Phase 1 below is the actual MVP: the smallest thing that answers "what am I missing" with your real collection. Each later phase is independently shippable.

### Phase 1 — The Wedge (~1 week)

The gap view working end-to-end with real data. Nothing else.

1. **Auth** — email/password, JWT (NestJS + Passport + bcrypt). No social login. See §7.1 for endpoint detail and §9 for validation rules.
2. **Seeded set templates** — 3–5 popular series (e.g., Lincoln Cents, State Quarters, Morgan Dollars), enough to cover your own collection. Templates live as versioned JSON files in the repo, loaded via a seed script (see §6.4 for the JSON shape).
3. **Coin CRUD (no images)** — denomination, year, mint mark, country, condition/grade (small enum — not the full Sheldon 1–70 scale), purchase price, notes, acquired date.
4. **Slot linking with auto-suggest** — as described in §4.2–4.3.
5. **Gap View** — per set: the owned/missing grid, completion %, key-date badges on missing slots.
6. **API documentation (Swagger)** — `@nestjs/swagger` wired up alongside the DTOs from day one, served at `/api/docs` on the deployed API. Not a separate effort: every DTO written for validation (§9) doubles as the Swagger schema source, so this is decorator upkeep, not a standalone task.
7. **Deploy** — live on Vercel + Render + Neon from the end of this phase. Deploying early surfaces environment problems while the app is still small.

**Exit test (v1 acceptance test):** register → activate the Lincoln Cents template → add 5 real coins → auto-suggest links them → gap view shows 5 owned / N missing with correct completion %. If that scripted path works end-to-end on the deployed app, Phase 1 is done. Anything not on that path is a later phase by definition.

#### Phase 1 screen list

| Screen | Purpose | Key elements |
| --- | --- | --- |
| Register / Login | Email+password auth | Form, inline validation errors, redirect to dashboard/set list on success |
| Set catalog | Browse available templates | List of `CollectionSet` where `isTemplate = true`, "Activate" button per set |
| My Sets | Sets the user is pursuing | List of `UserSet` rows joined to `CollectionSet`, each shows completion % as a quick summary, links to gap view |
| Gap view | The core feature | Grid/list per §4.1 |
| Coin list | All of the user's `CoinItem`s | Flat list, add/edit/delete |
| Coin add/edit form | Create or update a coin | Fields per §6.3, auto-suggest panel appears post-save if matches found |

### Phase 2 — Usable by Anyone (~1 week)

1. **Custom set builder.** This is the riskiest UI in the app and it needs real design, not "name + list of slots." Nobody will type 80 year/mint combinations into a form one at a time. The v1 answer is a **generator**: user specifies a year range, which mint marks apply, and optional exclusions ("1909–1958, mints P/D/S, skip 1922-P"), and the app generates the slot list, which the user can then hand-edit (add oddballs, mark key dates, reorder). Manual single-slot add/remove exists as the escape hatch, not the primary flow. See §7.2 for the generator's request/response shape.
2. **Search/filter** across the collection (year, set, denomination). At personal-collection scale this is a filter bar, not a search engine.
3. **Dashboard** — total coins, sets in progress, overall completion snapshot. Deliberately last in the phase: the gap view already *is* the dashboard for the thing that matters.
4. **Responsive pass** and general polish.
5. **README** — written properly; for a portfolio piece it matters as much as the code.

#### Phase 2 screen list

| Screen | Purpose | Key elements |
| --- | --- | --- |
| Custom set builder | Generate a set from a rule, then hand-edit | Year range inputs, mint-mark checkboxes, exclusion list input, generated slot preview table (editable inline), key-date toggle per row |
| Collection filter bar | Narrow the coin list | Dropdowns/chips for set, denomination, year range; combinable, no free-text search in v1 |
| Dashboard | At-a-glance summary | Total coins, active sets with mini completion bars, overall % across all active sets |

### Phase 3 — Photos

1. **Image upload to Cloudflare R2** — presigned upload URLs from the Nest API, 1–2 photos per coin (obverse/reverse), client-side downscale before upload, deletion cleanup when a coin or photo is removed.
2. Thumbnails in the collection list and gap view (owned slots can show the actual coin).

Budgeted as its own phase because upload flows always cost more than they look: presigned URL flow, size limits, orphaned-object cleanup, and loading states are each small but they add up to 2–3 real days. Nothing in this phase gets built early — the Phase 1 `imageUrls` column stays nullable and unused until this phase starts.

### Phase 4 — Stretch (design for, don't build)

- **Want-list with priority/budget** — this is where "owned but want a better example" lives, as an upgrade flag on a slot link, alongside "missing and actively hunting." A gap is structural; a want is intentional.
- CSV import/export (doubles as a "data portability" talking point).
- Public read-only shareable collection link (`/u/yourname/collection`) — great demo artifact.
- Value tracking (needs a pricing data source — separate research pass; most numismatic pricing APIs are paid).
- More templates and categories (world coins, banknotes), full Sheldon 1–70 grading, variety/error tracking.

## 6. Data Model

### 6.1 Entity summary

- **User** — id, email, password hash.
- **CollectionSet** — a set definition (template or user-created). `denomination` (shared enum — the set-side half of the auto-suggest match key), `isTemplate` flag; `ownerId` is null for templates, set for user-created sets.
- **SetSlot** — one expected item within a `CollectionSet` (year, mint mark, label, sort order, `isKeyDate`).
- **UserSet** — joins a `User` to a `CollectionSet` they're pursuing. **Every pursued set gets a `UserSet` row, including the user's own custom sets** — don't special-case "template vs. mine" in pursuit/progress logic; `CollectionSet.ownerId` answers *who may edit the set definition*, `UserSet` answers *who is collecting against it*. Two different questions.
- **CoinItem** — belongs to a `User`; denomination (same shared enum), year, mint mark, country, grade, purchase price, notes, acquired date, `imageUrls` list (empty until Phase 3), optional FK to a `SetSlot`.

**Key invariant:** multiple `CoinItem`s may exist for the same year/mint (duplicates are normal), but **at most one `CoinItem` may be linked to a given `SetSlot` per user** — enforced with a unique constraint on `(userId, slotId)`. Relinking a slot to a different coin replaces the link rather than erroring; the old coin stays in the collection, just unlinked. Full duplicate *tracking* (flagging spares for trade) stays in Phase 4.

Gap computation: for a given `UserSet`, gap = the `SetSlot`s with no linked `CoinItem` for that user. Keep this as a simple query — it's the core product, don't over-engineer it.

### 6.2 Prisma schema sketch

Field-level detail, for reference when scaffolding — adjust types to taste during implementation, but the shape and constraints below are load-bearing (especially the unique constraints):

```prisma
// Mirrored as a TypeScript enum in packages/shared — one source of truth for FE forms,
// BE DTOs, and this schema. Extend when new categories arrive (Phase 4).
enum Denomination {
  Cent
  Nickel
  Dime
  Quarter
  HalfDollar
  Dollar
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())

  coinItems CoinItem[]
  userSets  UserSet[]
  ownedSets CollectionSet[] @relation("SetOwner")
}

model CollectionSet {
  id           String       @id @default(uuid())
  name         String
  category     String       // display grouping, e.g. "cents", "quarters", "dollars"
  denomination Denomination // set-side half of the auto-suggest match key (§4.2)
  isTemplate   Boolean      @default(false)
  ownerId    String?  // null for templates, set for user-created sets
  owner      User?    @relation("SetOwner", fields: [ownerId], references: [id])
  createdAt  DateTime @default(now())

  slots    SetSlot[]
  userSets UserSet[]
}

model SetSlot {
  id          String        @id @default(uuid())
  setId       String
  set         CollectionSet @relation(fields: [setId], references: [id], onDelete: Cascade)
  year        Int
  mintMark    String?       // null = struck with no mint mark (see §6.3 — never "P")
  label       String?       // override display label for irregular slots (varieties)
  sortOrder   Int
  isKeyDate   Boolean       @default(false)

  coinItems CoinItem[]

  @@index([setId])
  // Natural identity of a slot — doubles as the seed script's upsert key (§6.4).
  // Note: Postgres treats NULLs as distinct in unique constraints, so the seed
  // script's own dedupe on this key is the real guard; the constraint documents intent.
  @@unique([setId, year, mintMark, label])
}

model UserSet {
  id        String        @id @default(uuid())
  userId    String
  user      User          @relation(fields: [userId], references: [id])
  setId     String
  set       CollectionSet @relation(fields: [setId], references: [id])
  activatedAt DateTime    @default(now())

  @@unique([userId, setId])
}

model CoinItem {
  id            String    @id @default(uuid())
  userId        String
  user          User      @relation(fields: [userId], references: [id])
  denomination  Denomination
  year          Int
  mintMark      String?   // null = no mint mark on the coin (see §6.3)
  country       String    @default("US")
  grade         String?   // small enum, see §6.3
  purchasePrice Decimal?  // USD only in v1 (see §6.3)
  notes         String?
  acquiredDate  DateTime?
  imageUrls     String[]  @default([]) // empty (not nullable — Prisma scalar lists can't be null) and unused until Phase 3
  slotId        String?
  slot          SetSlot?  @relation(fields: [slotId], references: [id], onDelete: SetNull)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([userId, slotId])
}
```

### 6.3 Field-level notes

- `denomination` (`CollectionSet` and `CoinItem`) — a single shared enum defined in `packages/shared` and mirrored in the Prisma schema, **never free text**. It's half of the auto-suggest match key (§4.2); free text here ("penny" vs "cent" vs "1c") would silently break matching and the Phase 2 filter bar. The coin form is a dropdown driven by the shared enum. One denomination per set is accurate for every targeted series; a hypothetical mixed-denomination set is a Phase 4 problem.
- `CoinItem.grade` — small enum in Phase 1 (e.g. `Poor, Fair, Good, VeryGood, Fine, VeryFine, ExtremelyFine, AboutUncirculated, Uncirculated`), not the full Sheldon 1–70 numeric scale. Full grading scale is a Phase 4 stretch item.
- `CoinItem.mintMark` and `SetSlot.mintMark` — nullable string, not an enum, since mint marks vary by country/series (D, S, CC, O, W, none). Matching treats `null` as an exact value ("no mint mark"), not a wildcard. **Convention (decided): a coin struck with no mint mark is stored as `null`, never `"P"`** — this matches what's physically on the coin (pre-2017 Philadelphia cents, pre-1980 Philadelphia issues generally carry no mark) and is what users will naturally enter. Template JSON follows the same convention. The coin form's mint-mark field offers "None" as the default option; if a user types/selects `P` for a series where Philadelphia struck without a mark, normalize to `null` at the API boundary rather than trusting the UI. Display-wise, a `null` mint mark renders as just the year ("1909"), not "1909-P".
- `SetSlot.label` — optional override for slots that don't fit the year+mint pattern cleanly (e.g. a slot representing a variety); when null, the UI derives the display label from year + mintMark. `label` is also part of the slot's natural identity — it's what distinguishes 1909-S from 1909-S VDB in the `(setId, year, mintMark, label)` unique key.
- Money (`purchasePrice`) — stored as `Decimal`, never `Float`, to avoid rounding artifacts on currency values. **USD only in v1 (decided):** no currency column; the field label says "Purchase price (USD)". Multi-currency joins value tracking in Phase 4 — adding a `currency` column then is a cheap additive migration.

### 6.4 Seed template JSON shape

Templates are versioned JSON files under a `seed/templates/` directory, one file per set, loaded by a seed script — **never inserted into the DB by hand**, not even during local dev. Shape:

```json
{
  "name": "Lincoln Wheat Cents",
  "category": "cents",
  "denomination": "Cent",
  "slots": [
    { "year": 1909, "mintMark": null, "label": "1909 VDB", "sortOrder": 1, "isKeyDate": false },
    { "year": 1909, "mintMark": null, "sortOrder": 2, "isKeyDate": false },
    { "year": 1909, "mintMark": "S", "sortOrder": 3, "isKeyDate": true },
    { "year": 1909, "mintMark": "S", "label": "1909-S VDB", "sortOrder": 4, "isKeyDate": true }
  ]
}
```

Note the mint-mark convention from §6.3 applied: Philadelphia issues are `mintMark: null` (they carry no mark on the coin), never `"P"`. A template that writes `"P"` would never match user-entered coins.

**Import command:** wired through Prisma's native seed hook rather than a bespoke script runner:

```json
// package.json
{
  "prisma": { "seed": "ts-node prisma/seed.ts" }
}
```

```bash
npx prisma db seed        # local dev — reads seed/templates/*.json, upserts into Postgres
npx prisma migrate reset  # also re-runs the seed automatically after wiping the dev DB
```

`prisma/seed.ts` walks `seed/templates/*.json` and upserts each into `CollectionSet` (keyed on set `name`) + `SetSlot` (keyed on the natural key `(setId, year, mintMark, label)` — the same tuple as the schema's unique constraint). **Slots are upserted per-key, never replaced wholesale:** a slot whose natural key still exists in the JSON keeps its row ID (updating `sortOrder`/`isKeyDate` in place), slots new in the JSON are inserted, and slots absent from the JSON are deleted. This matters because `CoinItem.slotId` points at slot rows — a wholesale delete-and-recreate would generate new IDs and silently sever every user's links to that set on every template correction, destroying exactly the linking work the app exists to encourage. With natural-key upserts, fixing a typo in `isKeyDate` or `sortOrder` touches nothing; only a slot whose year/mint/label actually changes (which genuinely is a different slot) drops its links. Idempotent by construction — re-running after a template correction, or after `migrate reset`, never duplicates rows. This is the *only* sanctioned way template data enters the database: no manual `INSERT`s via Prisma Studio or psql, in dev or prod, so the JSON files stay the single source of truth and the diff history in git doubles as an audit trail for template corrections (relevant given the seed-data-accuracy risk in §13).

## 7. API Surface (Phase 1 & 2)

REST, JSON, JWT bearer auth on all routes except `/auth/register` and `/auth/login`. Versioning via a leading `/api/v1` prefix from day one (cheap now, painful to retrofit).

**Docs:** every route below is documented via `@nestjs/swagger` decorators (`@ApiTags`, `@ApiOperation`, `@ApiResponse`, DTOs annotated with `@ApiProperty`) and served as interactive OpenAPI docs at `/api/docs` on the running API — grows automatically as endpoints are added in Phase 2, no separate doc-writing pass.

### 7.1 Phase 1

| Method & Path | Purpose | Notes |
| --- | --- | --- |
| `POST /api/v1/auth/register` | Create a user | Email + password, returns JWT |
| `POST /api/v1/auth/login` | Authenticate | Returns JWT |
| `GET /api/v1/sets` | List `CollectionSet`s (templates + own) | Filter by `isTemplate` |
| `POST /api/v1/sets/:id/activate` | Create a `UserSet` row | Idempotent — activating twice is a no-op, not an error |
| `GET /api/v1/user-sets` | List the current user's pursued sets | Includes computed completion % |
| `DELETE /api/v1/user-sets/:id` | Stop pursuing a set | Deletes the `UserSet` row; linked coins stay in the collection with links intact (reactivating restores the same progress) |
| `GET /api/v1/user-sets/:id/gap` | Gap view data for one pursued set | Returns all slots with owned/missing + linked coin summary |
| `GET /api/v1/coins` | List the current user's coins | |
| `POST /api/v1/coins` | Create a coin | Returns auto-suggest candidates (§4.2) alongside the created coin |
| `PATCH /api/v1/coins/:id` | Update a coin | Re-runs auto-suggest if denomination/year/mintMark changed |
| `DELETE /api/v1/coins/:id` | Delete a coin | Unlinks any slot it was linked to |
| `POST /api/v1/coins/:id/link` | Link a coin to a slot | Body: `slotId`; replaces existing link on that slot if present — unlink+link run in one transaction (§9) |
| `POST /api/v1/coins/:id/unlink` | Unlink a coin from its slot | |

### 7.2 Phase 2

| Method & Path | Purpose | Notes |
| --- | --- | --- |
| `POST /api/v1/sets` | Create a custom `CollectionSet` | `ownerId` = current user, `isTemplate = false` |
| `POST /api/v1/sets/generate-slots` | Generator preview (no persistence) | Body: `{ yearStart, yearEnd, mintMarks: string[], exclusions: [{year, mintMark}] }` → returns proposed `SetSlot[]` for client-side editing before save |
| `PATCH /api/v1/sets/:id/slots` | Bulk upsert slots after hand-editing | Used after the generator preview is edited and saved |
| `GET /api/v1/coins?set=&denomination=&yearMin=&yearMax=` | Filtered coin list | Query params combine with AND |
| `GET /api/v1/dashboard` | Summary stats | Total coins, active set count, overall completion |

## 8. Architecture & Tech Stack

Next.js and NestJS run as **separate services at runtime** — the right call for the portfolio goal, since it forces a real API boundary (DTOs, validation, auth guards, versioning) instead of Next.js API routes hiding all of that. This is a runtime/framework decision, not a repo-layout one — see §8.1 for how the two services are housed in source control.

| Layer    | Choice                                       | Why                                                                                                                                                                                         |
| -------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend | Next.js (App Router)                         | You already know it cold; App Router + server components is worth having on the resume too.                                                                                                 |
| Backend  | NestJS                                       | Structured, testable, shows you can design a real service (modules, DTOs, guards, interceptors).                                                                                            |
| DB       | PostgreSQL                                   | Sets/slots/coins are genuinely relational.                                                                                                                                                  |
| ORM      | **Prisma** (decided)                         | For a solo project on this timeline, Prisma's DX and migration story win.                                                                                                                    |
| Auth     | Passport + JWT + bcrypt, hand-rolled in Nest | Shows real backend auth skill rather than outsourcing it to a BaaS.                                                                                                                         |
| API docs | `@nestjs/swagger` (OpenAPI), served at `/api/docs` | Auto-generated from existing DTOs/decorators — near-zero marginal cost since Phase 1 already needs those DTOs for validation. Live, browsable API reference is also a good interview artifact. |
| Images   | Cloudflare R2 — **Phase 3 only**             | Nothing image-related gets built or configured before then; the only Phase 1 concession is the nullable `imageUrls` column.                                                                 |

### 8.1 Repo layout: monorepo

Both services live in **one git repo** using npm/pnpm workspaces, not two separate repos. This is orthogonal to the "separate services" decision above — the two apps are still independently built, deployed, and run as different processes; only the source control and local dev orchestration are unified.

```
coin-collector-companion/
├── apps/
│   ├── web/          # Next.js (App Router)
│   └── api/          # NestJS
├── packages/
│   └── shared/       # shared TypeScript types: DTO shapes, enums (denomination, grade, mint marks), gap-view response types
├── docs/
├── seed/templates/   # versioned JSON set templates (§6.4)
├── package.json       # workspace root
└── pnpm-workspace.yaml
```

**Why:** the FE and BE independently duplicating request/response shapes is exactly the kind of drift a portfolio reviewer will notice (a coin DTO changes in Nest, the Next.js form silently falls out of sync). A `packages/shared` package that both apps import gives one source of truth for those types without merging the runtimes. It also means a full-stack change (e.g. adding a field to `CoinItem`) is one PR touching `apps/api`, `apps/web`, and `packages/shared` together, instead of two PRs across two repos that have to be sequenced.

**Deployment impact:** Vercel and Render both support building from a subdirectory of a monorepo (Vercel: set the project's "Root Directory" to `apps/web`; Render: set "Root Directory" to `apps/api` and point its build command at the workspace, e.g. `pnpm --filter api build`). Each still deploys independently on push — the monorepo doesn't couple their release cadence. One-time config cost when setting up hosting (§10), not an ongoing one.

## 9. Non-Functional Requirements

- **Validation:** all mutating endpoints validate via Nest DTOs + `class-validator` (e.g. `year` bounded to a sane range like 1793–current year, `email` format, password minimum length). Reject invalid payloads with 400 + field-level error messages; the frontend surfaces these inline on the form, not as a toast.
- **Auth errors:** 401 on missing/expired JWT, 403 on attempting to act on another user's resource (e.g. linking a coin you don't own, editing a `CollectionSet` you don't own). Ownership checks happen at the service layer, not just route guards.
- **Idempotency:** activating an already-activated set, or re-running the seed script, must not create duplicate rows — covered by unique constraints (`UserSet(userId, setId)`, `SetSlot(setId, year, mintMark, label)`) and upsert logic.
- **Transactional link replacement:** linking a coin to an already-filled slot (via `POST /coins/:id/link` or an auto-suggest "Replace current link" confirm) performs the unlink of the old coin and the link of the new one inside a single Prisma transaction (`$transaction`). Two independent writes would either violate the `(userId, slotId)` unique constraint on the second write or, on partial failure, leave the slot empty when the user asked for a replacement.
- **JWT storage & CORS (decided):** the API returns the JWT in the response body; the frontend sends it as an `Authorization: Bearer` header. No cookies — Vercel and Render are different origins, and cross-site cookie handling (SameSite, third-party cookie restrictions) costs more than it buys at this scale. The Nest API enables CORS restricted to the deployed frontend origin (+ localhost in dev). Token expiry: a single access token, 7-day expiry, no refresh-token flow — on expiry the user logs in again. Acceptable for a personal-scale app and a deliberate, explainable trade-off (a refresh flow is a Phase 4-grade addition if ever needed).
- **Rate limiting:** `@nestjs/throttler` on the `/auth/*` routes (e.g. 5 attempts/minute per IP) — the API is publicly deployed with open registration, and brute-force protection on login is table stakes a reviewer will look for. Default (generous) throttle on the rest of the API.
- **Error format:** consistent JSON error shape across the API (`{ statusCode, message, error }`, Nest's default exception filter shape is fine — don't build a custom envelope).
- **Performance:** not a concern at personal-collection scale (hundreds of coins, dozens of sets) — the gap query is a straightforward join/filter, no need for caching or pagination in Phase 1. Revisit only if the public-collection-link stretch item (Phase 4) makes traffic patterns unpredictable.

## 10. Free-Tier Hosting Plan (checked against current 2026 offerings)

| Piece            | Pick                                                                       | Free-tier reality                                                                                                                                                                                                                                                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend         | **Vercel** (Hobby)                                                         | Best fit for Next.js, free for personal projects.                                                                                                                                                                                                                                                                                                               |
| Backend          | **Render** (free Web Service)                                              | 750 hrs/month, 512MB RAM — enough for a Nest API. Spins down after 15 min idle, ~30–60s cold start on wake.                                                                                                                                                                                                                                                     |
| Database         | **Neon** (free tier)                                                       | 0.5GB storage + 100 CU-hours/month, scale-to-zero that wakes on request. Preferred over Supabase here because Supabase's free tier auto-pauses projects after 7 days of inactivity and needs a manual un-pause from the dashboard — bad for a demo link clicked on a quiet week. Also: you've already used Supabase in the financial tracker; Neon shows range. |
| Images (Phase 3) | **Cloudflare R2** (free tier)                                              | 10GB storage, free egress, ~1M writes/10M reads per month. Better fit than Cloudinary, whose free tier is one shared pool of 25 "credits" covering storage + bandwidth + transformations together — it burns fast once real photos are served constantly. R2's zero egress fee is the deciding factor for an image-serving workload.                            |
| CI/CD            | GitHub Actions (free for public repos) + Vercel/Render auto-deploy on push | No extra cost; CI badge on the repo doesn't hurt.                                                                                                                                                                                                                                                                                                               |

**Total cost: $0/month.**

**Monorepo note:** per §8.1, Vercel's Root Directory is set to `apps/web` and Render's to `apps/api`; each auto-deploys independently on push to the shared repo, so the monorepo doesn't change this table.

**Cold start, decided:** accept the sleep. Add a skeleton loader on first load and a one-line note in the README ("free-tier hosting — first request after idle takes ~30s"). A keep-warm cron is possible, but explaining a consciously chosen trade-off in an interview is more impressive than hiding one — and the loading state is itself a small demo of frontend care.

## 11. Build Plan

### Phase 1 (Days 1–7)

- **Days 1–2:** Set up the pnpm workspace (`apps/web`, `apps/api`, `packages/shared`, §8.1), Prisma schema + NestJS skeleton (auth module, sets/slots/coins CRUD), Neon connected. Deploy the empty API to Render immediately.
- **Days 3–4:** Compile 3–5 templates as JSON (US Mint / PCGS / NGC published checklists make this transcription, not research — but budget the hours, it's tedious), load via `npx prisma db seed` (§6.4). Next.js scaffolding + auth flow.
- **Days 5–6:** Coin CRUD UI, slot linking with auto-suggest.
- **Day 7:** Gap view. Give it the most polish of anything in the app — it's the product. Run the acceptance test on the deployed app with your real coins.

### Phase 2 (Days 8–14)

- **Days 8–10:** Custom set builder (the generator UI — expect this to take the full three days).
- **Days 11–12:** Search/filter, dashboard.
- **Days 13–14:** Responsive pass, seed your full real collection, fix what breaks, write the README.

### Phase 3 (when you feel like it)

- **~3 days:** R2 bucket + presigned upload endpoint, upload UI with client-side downscale, thumbnails in list and gap view, deletion cleanup.

### Phase 4

- Unscheduled; pick items off the list in §5 as motivation strikes.

## 12. Success Criteria

- You use it for your own collection instead of the apps you bounced off.
- The gap view answers "what am I missing" faster/clearer than any competitor you tried.
- It's deployed, live, and demoable with your real dataset — not lorem-ipsum seed data.
- The Phase 1 acceptance test (§5) passes end-to-end on the deployed app.
- The repo is clean enough to walk an interviewer through the API design in 5 minutes.

## 13. Open Questions / Risks

- **Seed data accuracy:** compiling year/mint lists is a few hours of careful transcription per series. An error in a template silently corrupts every user's completion % for that set — worth a quick cross-check of each list against a second source. Mitigated (v1.1): corrections are now safe to ship — the natural-key slot upsert (§6.4) means re-seeding a fixed template preserves users' existing slot links instead of severing them.
- **Mint-mark convention drift:** the "no mark = `null`, never `P`" rule (§6.3) lives in three places — template JSON, the coin form, and the API normalization — and auto-suggest silently degrades if any of them drifts. Worth one integration test that adds a no-mark Philadelphia coin and asserts it matches its slot.
- **Custom set builder scope creep:** the generator can grow endlessly clever (denominations with irregular mint patterns, proof-only issues). The Phase 2 version handles the common case (year range × mint marks × exclusions) and leaves the rest to manual slot editing.
- **General scope creep:** value tracking and want-lists remain tempting and remain Phase 4 on purpose. The acceptance test is the firewall — if it's not on that path, it's not Phase 1.
- **Auto-suggest ambiguity (from §4.3):** a coin matching multiple open slots needs a clear multi-candidate UI in Phase 1 — and it's not an edge case: any set with variety slots (1909-S vs 1909-S VDB) makes multi-candidate the *routine* path for those coins. Budget for it as a first-class piece of the linking flow, not a fallback.
