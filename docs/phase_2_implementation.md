# Phase 2 Implementation Prompts

Companion to [prd.md](prd.md) §5 (Phase 2) and [system-design.md](system-design.md). Each
section below is a self-contained prompt for implementing one Phase 2 feature — grounded in
the module/file conventions already established in Phase 1 (DTO style, ownership-check
pattern, `packages/shared` as source of truth, TanStack Query hook shape). Hand one off at a
time; they don't depend on each other except where noted.

---

## 1. Custom set builder

```
Implement the Phase 2 custom set builder (PRD §5.2, §7.2 endpoints; SD §5 D2 module boundaries).

BACKEND (apps/api/src/sets):
- Add three DTOs in apps/api/src/sets/dto/, following the class-validator style of
  find-sets-query.dto.ts and coins/dto/create-coin.dto.ts:
  - GenerateSlotsDto: { yearStart: number, yearEnd: number, mintMarks: string[],
    exclusions: { year: number, mintMark: string | null }[] }. Validate yearStart <= yearEnd,
    a sane year bound like the coin DTO's, mintMarks entries as plain strings (nullable
    entries represent "no mark" — reuse the same "P"/"" -> null normalization convention
    from CreateCoinDto).
  - CreateSetDto: { name: string, category: string, denomination: Denomination }. No
    isTemplate/ownerId fields — service sets isTemplate: false, ownerId: currentUser.id,
    same as how activate() derives ownership rather than trusting the body.
  - BulkUpsertSlotsDto: { slots: { year, mintMark, label, sortOrder, isKeyDate }[] }.
- SetsController: add POST /sets/generate-slots (pure function, no DB write — returns a
  preview array, same natural-key shape as SetSlot minus id/setId), POST /sets (create),
  PATCH /sets/:id/slots (bulk upsert).
- SetsService.upsertSlots(userId, setId, slots): 404 unknown set, 403 if
  set.ownerId !== userId (never allow editing a template's slots via this path — a set with
  ownerId === null is always a template and must reject), then diff incoming slots against
  existing ones on the natural key (year, mintMark, label) IN SERVICE CODE, not a raw Prisma
  upsert — this is the same reasoning as prisma/seed.ts's slot diffing (Postgres treats NULL
  as distinct in unique constraints, so a naive upsert silently duplicates null-mint rows).
  Matched slots update in place (row id stable ⇒ any existing CoinItem.slotId link survives);
  unmatched incoming slots insert; existing slots absent from the payload delete. Never
  delete-and-recreate wholesale — a user may have already activated their own set and linked
  coins to it before hand-editing the slot list.
- generateSlots(dto): pure loop over [yearStart..yearEnd] × mintMarks, skipping any
  (year, mintMark) pair present in exclusions, assigning sortOrder by iteration order. No
  isKeyDate default beyond false — that's a hand-edit-only field, the generator has no way to
  know which years are key dates.
- Add matching request/response types to packages/shared/src/contracts.ts (this package is
  the source of truth per SD §4 — if code and this drift, the package wins).

FRONTEND (apps/web/src):
- lib/sets-api.ts: add generateSlots, createSet, upsertSlots.
- lib/hooks/use-sets.ts: add a useGenerateSlots mutation and a useCreateCustomSet flow.
- New route app/(app)/sets/new/page.tsx: year range inputs, mint-mark checkboxes, exclusion
  list input (reuse components/auth/form-field.tsx's pattern for inline errors) → calls
  generate-slots for a preview table. Preview rows are inline-editable (year, mintMark, label,
  sortOrder, isKeyDate toggle) with manual add/remove row as the escape hatch — this is the
  primary Phase 2 UI risk per the PRD, budget real design time here, not "name + list of slots."
  On save: POST /sets then PATCH /sets/:id/slots with the (possibly hand-edited) rows.
- Add a "Create custom set" entry point from app/(app)/sets/page.tsx (the existing catalog
  page) — nothing currently links into a set-creation flow.

CONSTRAINTS: one denomination per set (no per-slot denomination — SD/PRD reject mixed sets
until Phase 4); mint-mark "no mark" is null, never "P", everywhere in this flow including the
generator and the hand-edit table; label is optional and is part of the slot's natural
identity, same as seeded templates.
```

---

## 2. Search / filter bar

```
Implement Phase 2 collection search/filter (PRD §5.2, §7.2: GET /coins?set=&denomination=&yearMin=&yearMax=).

BACKEND (apps/api/src/coins):
- Add FindCoinsQueryDto in apps/api/src/coins/dto/, mirroring the string->typed @Transform
  pattern in sets/dto/find-sets-query.dto.ts (query params always arrive as strings even under
  the global transform:true pipe):
  { set?: string (uuid), denomination?: Denomination, yearMin?: number, yearMax?: number }.
  All optional; combine with AND per PRD §7.2 ("query params combine with AND").
- CoinsController.findAll: accept the query DTO, pass through to CoinsService.findAll.
- CoinsService.findAll(userId, query): build a Prisma where clause —
  { userId, ...(denomination && {denomination}), ...(yearMin/yearMax && {year: {gte, lte}}),
  ...(set && { slot: { setId: set } }) }. Note "set" filters on the coin's LINKED slot's set,
  not a direct coin.setId column (coins don't have one) — a coin with no slotId simply never
  matches a set filter, which is correct (it isn't part of that set's gap view either).
- No changes to CreateCoinDto/UpdateCoinDto — this is read-path only.

FRONTEND (apps/web/src):
- lib/coins-api.ts: extend getCoins to accept an optional filters object and serialize it to
  query params (URLSearchParams, only including set keys).
- lib/hooks/use-coins.ts: useCoins(filters) — include the filters object in the query key
  (e.g. ['coins', filters]) so each distinct filter combination caches separately.
- app/(app)/coins/page.tsx: add a filter bar — dropdown for set (source: useUserSets(), not
  useTemplateSets(), since filtering only makes sense against sets the user actually pursues),
  dropdown for denomination (packages/shared's Denomination enum, same formatter used on the
  sets catalog page for "Half Dollar" display), two number inputs for year min/max. Chips/
  dropdowns per PRD — no free-text search box, this isn't a search engine at personal-collection
  scale. Filters are combinable and reset-able; keep filter state in the page component (no
  new global state library, per SD §3).

VERIFY: a coin filtered by set should only show if it's linked (via slotId) to that set — test
against a set with some linked and some unlinked coins to confirm the join direction is right.
```

---

## 3. Dashboard

```
Implement the Phase 2 dashboard (PRD §5.2, §7.2: GET /dashboard) — deliberately the smallest
and last piece of Phase 2 per the PRD ("the gap view already is the dashboard for the thing
that matters").

BACKEND (apps/api/src):
- New DashboardModule (apps/api/src/dashboard/) — doesn't map to an existing entity, so it
  gets its own thin module per SD D2's "mirrors the entity model" reasoning being a default,
  not a hard rule; keep it to a controller + service, no new Prisma models.
- GET /dashboard → DashboardResponse: { totalCoins: number, activeSetsCount: number,
  overallCompletionPercent: number, sets: UserSetSummary[] } — reuse UserSetsService's
  existing groupBy-based owned/total counting (SD D4: two groupBy queries merged in memory,
  not a per-set loop) rather than writing a second implementation; either inject
  UserSetsService into DashboardService or lift the shared counting logic into a method both
  can call. totalCoins is a plain coinItem.count({ where: { userId } }).
  overallCompletionPercent = round(sum(ownedSlots) / sum(totalSlots) * 100) across all active
  sets, 0 if the user has no active sets (avoid divide-by-zero) — same "one rounding rule, one
  place" convention as 5.6's My Sets page, just computed server-side here since the caller
  doesn't already have per-set data to derive it from.
- Add DashboardResponse to packages/shared/src/contracts.ts, reusing the existing
  UserSetSummary type for the sets array rather than inventing a parallel shape.

FRONTEND (apps/web/src):
- lib/dashboard-api.ts: thin getDashboard wrapper, same shape as user-sets-api.ts.
- lib/hooks/use-dashboard.ts: useDashboard() query, key ['dashboard'].
- New route app/(app)/dashboard/page.tsx: stat tiles for total coins / active sets /
  overall completion, plus a list of mini completion bars per set (reuse the percentage
  display already built for my-sets/page.tsx rather than re-deriving the rounding logic on
  the frontend — this endpoint already returns the number precomputed).
- No global nav component exists yet anywhere in the app (noted in every prior page's build
  log) — Phase 2 pages still won't be reachable from each other without one. Decide explicitly
  whether this task also adds a minimal nav bar (sets / my-sets / coins / dashboard) or whether
  that's tracked as its own separate Phase 2 polish item; don't silently skip it since the
  dashboard is the first page where "no way to get here" actually blocks the PRD's own success
  criteria ("walk an interviewer through it in 5 minutes").

VERIFY against the seeded dev DB: a user with two active sets, one complete and one at 50%,
should show overallCompletionPercent as the slot-weighted average (not a simple average of the
two percentages) — confirm the arithmetic explicitly, since those two numbers diverge whenever
set sizes differ.
```
