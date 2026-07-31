# Technical Plan: Set editor + gap view + collection page (backlog_week3.md Day 4)

**Run:** run_20260721_171115
**Date:** 2026-07-21

## Summary

Builds the set editor (`/sets/[id]`) and the global collection page (`/collection`),
the two remaining `apps/web` surfaces from Week 3. Both are additive on top of
Day 1–3 work already in the repo: the editor reuses Day 3's `useSetGaps`,
`useRenameSet`, `useDeleteSet` (all already in `use-user-sets.ts`) and Day 2's
`usePublicSet` (works for any set — every set is public per SD §4.6) rather than
inventing new duplicate hooks for data that's already fetchable. Two genuinely new
pieces of API surface are added (`PATCH /sets/:id/coins`, `PATCH/GET /collection`),
plus one small refactor: the catalog filter form (2.2) is extracted into a shared
component so the editor's "Add coins" panel reuses it instead of duplicating it.

## Approach

1. **`user-sets-api.ts` (MODIFY):** add `patchSetCoins(id, body: PatchSetCoinsRequest): Promise<UserSetCoinSummary[]>`
   wrapping `PATCH /sets/:id/coins`, next to the existing `renameSet`/`deleteSet`/`getSetGaps`
   siblings that already wrap this same controller's other endpoints.

2. **`use-user-sets.ts` (MODIFY):** add `usePatchSetCoins(setId)`, a mutation over
   `patchSetCoins`. On success, invalidate `['user-sets', setId, 'gaps']` (the gap-view
   query for this set) and `['public-sets', setId]` (the `usePublicSet` detail query,
   whose `coins` array must reflect the add/remove). This follows the existing
   1:1 pairing in this codebase between an `*-api.ts` file and its `use-*.ts` hook
   file (catalog-api/use-catalog, public-sets-api/use-public-sets, user-sets-api/use-user-sets)
   — `usePatchSetCoins` lives beside `useSetGaps` rather than in a new file, since
   both wrap the same `/sets/:id/...` resource.

3. **`collection-api.ts` (CREATE):** `getCollection(filters: { country?: string; year?: number }): Promise<OwnershipItem[]>`
   wrapping `GET /collection` (query-string built the same way `catalog-api.ts`'s
   `getCatalog` does — skip empty/undefined filter values), and
   `setOwnership(coinId: string, owned: boolean): Promise<SetOwnershipResponse>`
   wrapping `PATCH /collection/:coinId` with body `{ owned }`.

4. **`use-collection.ts` (CREATE):**
   - `useCollection(filters)`: query, `queryKey: ['collection', filters]`.
   - `useSetOwnership()`: mutation over `setOwnership`, variables `{ coinId, owned }`.
     On success, invalidates `queryKey: ['user-sets']` (prefix match — this is a
     *broad* invalidation on purpose: TanStack Query's default partial-key matching
     means invalidating `['user-sets']` also invalidates every currently-mounted
     `['user-sets', <id>, 'gaps']` query, not just the set the toggle happened in,
     which is exactly what PRD requirement 13 needs — a coin owned in one set must
     show owned in every other set's gap view too, not just the one being edited)
     and `queryKey: ['collection']` (prefix match, covers every filter variant).

5. **`components/catalog/catalog-filter-form.tsx` (CREATE):** extract the inline
   filter form currently in `catalog/page.tsx` (country/denomination/name/yearMin/yearMax
   + submit) into `CatalogFilterForm({ testIdPrefix, onSubmit })`. Test selectors are
   built as `` `${testIdPrefix}-filter-form` ``, `` `${testIdPrefix}-filter-country` ``,
   etc. — parameterizing the prefix (rather than hardcoding `catalog-*`) is what makes
   this safe to mount twice on one page tree (once on `/catalog`, once inside the
   editor's "Add coins" panel) without colliding `data-testid`s.

6. **`catalog/page.tsx` (MODIFY):** replace the inline form JSX with
   `<CatalogFilterForm testIdPrefix="catalog" onSubmit={...} />`. Using the literal
   string `"catalog"` reproduces the exact `data-testid` values the page already has
   today (`catalog-filter-country`, `catalog-filter-submit`, etc.) — this is a
   pure refactor, not a behavior or contract change, and the existing
   `catalog/page.test.tsx` must keep passing unmodified.

7. **`sets/[id]/page.tsx` (CREATE):** the editor. Unwraps the Next.js `params` Promise
   with the `useEffect`/`useState` pattern already used by `sets/canonical/[id]/page.tsx`
   and `sets/public/[id]/page.tsx` (documented gotcha: `use(params)` inside `<Suspense>`
   never re-renders on resolution in this repo's jsdom+vitest setup — do not use it).
   Wrapped in `<RequireAuth>` (this route is already in Day 1's protected-route list).
   Data: `usePublicSet(id)` for the set's `name`/`userId`/ordered `coins` (works for
   any set, not just the caller's own, since every set is public);
   `useSetGaps(id)` for `slots`/`completionPercent` (owned status per coin);
   `useUserSets()` to determine `isOwner = userSets?.some(s => s.id === id)` — the
   only source of the caller's own set-ownership relationship, already fetched this
   same way by `/dashboard`. Renders the merged, position-sorted slot list always;
   when `isOwner` is true, additionally renders: per-slot toggle-owned button wired
   to `useSetOwnership()` (passing `{ coinId: slot.coin.id, owned: !slot.owned }` —
   never a client-held boolean flip, matching PRD/backlog's explicit "never a toggle
   client-side" instruction, since the request body must state the *target* value),
   per-slot remove button wired to `usePatchSetCoins(id)` with `{ remove: [slot.coin.id] }`
   (`PatchSetCoinsDto`'s `add`/`remove` arrays are catalog **coin** ids, confirmed
   against `SetsService.patchCoins`'s Prisma `coinId: { in: toRemove }` query — not
   the `UserSetCoin` row id), an "Add coins" panel (`CatalogFilterForm testIdPrefix="set-editor-add-coins"`
   + `useCatalog(filters)`, reused as-is, rendering each result with an "Add" button
   wired to `usePatchSetCoins(id)` with `{ add: [coin.id] }`), and rename
   (`useRenameSet`, existing) / delete (`useDeleteSet`, existing, redirect to
   `/dashboard` on success) controls. When `isOwner` is false, none of the above
   controls render — same read-only shape `sets/public/[id]/page.tsx` already uses.

8. **`collection-api.ts`/`use-collection.ts`** (from steps 3–4) back
   **`collection/page.tsx` (CREATE):** wrapped in `<RequireAuth>` (Day 1's protected
   list). A small local filter form (country text + year number — matching
   `FindCollectionQueryDto`'s actual two fields; deliberately NOT `CatalogFilterForm`,
   which has three extra fields — `denomination`/`name`/`yearMax` — the collection
   endpoint doesn't accept) driving `useCollection(filters)`. Renders each
   `OwnershipItem` via `formatCoinLabel(item.coin)` (no local re-implementation),
   with an owned-since date if useful, empty/loading/error states matching every
   other list page's convention (`ListSkeleton`, `-empty`, `-error` testids).

## Files changed

| File | Action | Purpose |
|------|--------|---------|
| `apps/web/src/lib/user-sets-api.ts` | MODIFY | Add `patchSetCoins(id, body)` wrapping `PATCH /sets/:id/coins` |
| `apps/web/src/lib/hooks/use-user-sets.ts` | MODIFY | Add `usePatchSetCoins(setId)` mutation |
| `apps/web/src/lib/collection-api.ts` | CREATE | `getCollection(filters)`, `setOwnership(coinId, owned)` |
| `apps/web/src/lib/hooks/use-collection.ts` | CREATE | `useCollection(filters)`, `useSetOwnership()` |
| `apps/web/src/components/catalog/catalog-filter-form.tsx` | CREATE | Shared filter form, extracted so it can be mounted twice with distinct testid prefixes |
| `apps/web/src/app/catalog/page.tsx` | MODIFY | Use `CatalogFilterForm` (testIdPrefix `"catalog"`, no testid/behavior change) |
| `apps/web/src/app/sets/[id]/page.tsx` | CREATE | Set editor: gap grid, toggle-owned, add/remove coins, rename/delete |
| `apps/web/src/app/collection/page.tsx` | CREATE | Global ownership list, filterable by country/year |

## Interface Contract

This section is the single source of truth for all names. The Tester and Coder read
this; neither invents anything independently.

### Module: `user-sets-api.ts` (MODIFY — add one export)
- **File:** `apps/web/src/lib/user-sets-api.ts`
- **New export:**
  ```typescript
  export async function patchSetCoins(
    id: string,
    body: PatchSetCoinsRequest,
  ): Promise<UserSetCoinSummary[]>
  ```
  Implementation: `apiFetch<UserSetCoinSummary[]>(\`/sets/${id}/coins\`, { method: 'PATCH', body: JSON.stringify(body) })` — same shape as the existing `renameSet`/`deleteSet` in this file.
- **Dependencies:** `apiFetch` (`./api-client`), `PatchSetCoinsRequest`/`UserSetCoinSummary` (`@coin-collector/shared`).

### Module: `use-user-sets.ts` (MODIFY — add one export)
- **File:** `apps/web/src/lib/hooks/use-user-sets.ts`
- **New export:**
  ```typescript
  export function usePatchSetCoins(setId: string) {
    // useMutation<UserSetCoinSummary[], ApiError, PatchSetCoinsRequest>
    // mutationFn: (body) => patchSetCoins(setId, body)
    // onSuccess: invalidateQueries({ queryKey: ['user-sets', setId, 'gaps'] })
    //            invalidateQueries({ queryKey: ['public-sets', setId] })
  }
  ```
- **Existing exports this plan reuses unmodified:** `useSetGaps(id)`, `useUserSets()`, `useRenameSet()`, `useDeleteSet()`.
- **Dependencies:** `patchSetCoins` (`@/lib/user-sets-api`), `ApiError` (`@/lib/api-client`).

### Module: `collection-api.ts` (CREATE)
- **File:** `apps/web/src/lib/collection-api.ts`
- **Exports:**
  ```typescript
  export interface CollectionFilters {
    country?: string;
    year?: number;
  }

  export async function getCollection(filters: CollectionFilters = {}): Promise<OwnershipItem[]>
  export async function setOwnership(coinId: string, owned: boolean): Promise<SetOwnershipResponse>
  ```
  `getCollection`: build a `URLSearchParams` skipping undefined/empty values (same
  pattern as `catalog-api.ts`'s `getCatalog`), `apiFetch<OwnershipItem[]>('/collection'+query)`.
  `setOwnership`: `apiFetch<SetOwnershipResponse>(\`/collection/${coinId}\`, { method: 'PATCH', body: JSON.stringify({ owned }) })`.
- **Dependencies:** `apiFetch` (`./api-client`), `OwnershipItem`/`SetOwnershipResponse` (`@coin-collector/shared`).

### Module: `use-collection.ts` (CREATE)
- **File:** `apps/web/src/lib/hooks/use-collection.ts`
- **Exports:**
  ```typescript
  export function useCollection(filters: CollectionFilters = {}) {
    // useQuery, queryKey: ['collection', filters], queryFn: () => getCollection(filters)
  }

  export function useSetOwnership() {
    // useMutation<SetOwnershipResponse, ApiError, { coinId: string; owned: boolean }>
    // mutationFn: ({ coinId, owned }) => setOwnership(coinId, owned)
    // onSuccess: invalidateQueries({ queryKey: ['user-sets'] })   // prefix match — see Approach step 4
    //            invalidateQueries({ queryKey: ['collection'] })  // prefix match
  }
  ```
- **Dependencies:** `getCollection`/`setOwnership`/`CollectionFilters` (`@/lib/collection-api`), `ApiError` (`@/lib/api-client`).

### Component: `CatalogFilterForm` (CREATE)
- **File:** `apps/web/src/components/catalog/catalog-filter-form.tsx`
- **Export:** `export default function CatalogFilterForm(props: CatalogFilterFormProps)`
- **Props:**
  ```typescript
  export interface CatalogFilterFormValues {
    country?: string;
    denomination?: string;
    name?: string;
    yearMin?: number;
    yearMax?: number;
  }

  export interface CatalogFilterFormProps {
    testIdPrefix: string;
    onSubmit: (values: CatalogFilterFormValues) => void;
  }
  ```
- **Test selectors** (templated as `{p}-filter-*`, `{p}` = `testIdPrefix`; this plan
  has exactly two call sites, so both concrete instantiations are spelled out below
  for the mechanical contract checker, which matches literal strings, not templates):
  - `data-testid="{p}-filter-form"` — the `<form>` root
  - `data-testid="{p}-filter-country"` — country input
  - `data-testid="{p}-filter-denomination"` — denomination input
  - `data-testid="{p}-filter-name"` — name input
  - `data-testid="{p}-filter-year-min"` — year-min input
  - `data-testid="{p}-filter-year-max"` — year-max input
  - `data-testid="{p}-filter-submit"` — submit button
  - Instantiation `testIdPrefix="catalog"` (used by `CatalogPage`): `data-testid="catalog-filter-form"`, `data-testid="catalog-filter-country"`, `data-testid="catalog-filter-denomination"`, `data-testid="catalog-filter-name"`, `data-testid="catalog-filter-year-min"`, `data-testid="catalog-filter-year-max"`, `data-testid="catalog-filter-submit"`
  - Instantiation `testIdPrefix="set-editor-add-coins"` (used by `SetEditorPage`): `data-testid="set-editor-add-coins-filter-form"`, `data-testid="set-editor-add-coins-filter-country"`, `data-testid="set-editor-add-coins-filter-denomination"`, `data-testid="set-editor-add-coins-filter-name"`, `data-testid="set-editor-add-coins-filter-year-min"`, `data-testid="set-editor-add-coins-filter-year-max"`, `data-testid="set-editor-add-coins-filter-submit"`
- **Dependencies:** none beyond React (`FormEvent`, `useState`).
- **Behavior:** manages the five fields as local state; on submit, calls
  `onSubmit({ country, denomination, name, yearMin: Number(yearMin) || undefined, yearMax: Number(yearMax) || undefined })`,
  converting `''` to `undefined` for every field exactly like `catalog/page.tsx`'s
  current inline `handleSubmit` does today.

### Page: `CatalogPage` (MODIFY — no new selectors, no behavior change)
- **File:** `apps/web/src/app/catalog/page.tsx`
- Replace the inline `<form data-testid="catalog-filter-form">...` block with
  `<CatalogFilterForm testIdPrefix="catalog" onSubmit={(values) => setFilters({ ...values, page: 1, limit: DEFAULT_LIMIT })} />`.
  All existing `data-testid`s (`catalog-filter-form`, `catalog-filter-country`, …,
  `catalog-filter-submit`) must resolve to the same values as today — the existing
  `apps/web/src/app/catalog/page.test.tsx` is the regression check for this file and
  must not need any edits.

### Page: `SetEditorPage` (CREATE)
- **File:** `apps/web/src/app/sets/[id]/page.tsx`
- **Export:** `export default function SetEditorPage({ params }: { params: Promise<{ id: string }> })`
- **Data hooks:** `usePublicSet(id)`, `useSetGaps(id)`, `useUserSets()`, `usePatchSetCoins(id)`, `useSetOwnership()`, `useRenameSet()`, `useDeleteSet()`, `useCatalog(filters)` (for the add-coins panel, filters held in local `useState`, same shape as `catalog/page.tsx`).
- **`isOwner` derivation:** `Boolean(userSets?.some((s) => s.id === id))` from `useUserSets()`.
- **Test selectors:**
  - `data-testid="set-editor-page"` — root `<main>`
  - `data-testid="set-editor-loading"` — while `usePublicSet`/`useSetGaps` is loading
  - `data-testid="set-editor-error"` — on `usePublicSet`/`useSetGaps` error
  - `data-testid="set-editor-name"` — the set's name (`<h1>`)
  - `data-testid="set-editor-completion"` — `{completionPercent}%` text
  - `data-testid="set-editor-gap-grid"` — `<ul>` of slots, sorted by `position` ascending
  - `data-testid="set-editor-gap-item"` — one `<li>` per slot (repeated per slot)
  - `data-testid="set-editor-gap-status"` — `"owned"` / `"missing"` text within a slot
  - `data-testid="set-editor-toggle-owned-button"` — per-slot toggle button, **owner only**
  - `data-testid="set-editor-remove-button"` — per-slot remove button, **owner only**
  - `data-testid="set-editor-rename-form"` / `data-testid="set-editor-rename-input"` / `data-testid="set-editor-rename-submit"` — **owner only**
  - `data-testid="set-editor-delete-button"` — **owner only**
  - `data-testid="set-editor-add-coins-panel"` — wraps `<CatalogFilterForm testIdPrefix="set-editor-add-coins" .../>`, **owner only**
  - `data-testid="set-editor-add-coins-results"` — `<ul>` of catalog results inside the panel
  - `data-testid="set-editor-add-coins-item"` — one `<li>` per catalog result
  - `data-testid="set-editor-add-coins-add-button"` — per-result "Add" button
- **Owner-only gating:** every testid tagged "owner only" above must be entirely
  absent from the DOM (not merely disabled) when `isOwner` is false — mirrors
  `sets/canonical/[id]/page.tsx`'s existing `isLoggedIn`-gated CTA pattern (`queryByTestId(...).not.toBeInTheDocument()`).
- **Dependencies:** `usePublicSet` (`@/lib/hooks/use-public-sets`), `useSetGaps`/`useUserSets`/`usePatchSetCoins`/`useRenameSet`/`useDeleteSet` (`@/lib/hooks/use-user-sets`), `useSetOwnership` (`@/lib/hooks/use-collection`), `useCatalog` (`@/lib/hooks/use-catalog`), `CatalogFilterForm` (`@/components/catalog/catalog-filter-form`), `formatCoinLabel` (`@coin-collector/shared`), `useRouter` (`next/navigation`, for the post-delete redirect to `/dashboard`), `RequireAuth` (`@/components/auth/require-auth`).

### Page: `CollectionPage` (CREATE)
- **File:** `apps/web/src/app/collection/page.tsx`
- **Export:** `export default function CollectionPage()`
- **Data hook:** `useCollection(filters)`, filters in local `useState<CollectionFilters>`.
- **Test selectors:**
  - `data-testid="collection-page"` — root `<main>`
  - `data-testid="collection-filter-form"` — the filter `<form>`
  - `data-testid="collection-filter-country"` — country input
  - `data-testid="collection-filter-year"` — year input
  - `data-testid="collection-filter-submit"` — submit button
  - `data-testid="collection-loading"` — loading state (`ListSkeleton`)
  - `data-testid="collection-error"` — error state
  - `data-testid="collection-empty"` — empty state (no owned coins yet)
  - `data-testid="collection-list"` — `<ul>` of results
  - `data-testid="collection-item"` — one `<li>` per `OwnershipItem`
- **Dependencies:** `useCollection` (`@/lib/hooks/use-collection`), `CollectionFilters` (`@/lib/collection-api`), `formatCoinLabel` (`@coin-collector/shared`), `ListSkeleton` (`@/components/ui/list-skeleton`), `RequireAuth` (`@/components/auth/require-auth`).

## Acceptance criteria coverage

| Criterion | Satisfied by |
|-----------|-------------|
| 1. `usePatchSetCoins` mutation, invalidates set detail/gap-view | `use-user-sets.ts` MODIFY: `usePatchSetCoins(setId)` |
| 2. Gap-view query hook, invalidatable by ownership mutation | Existing `useSetGaps` (reused, not duplicated) + `usePatchSetCoins`'s/`useSetOwnership`'s invalidation both target its `['user-sets', id, 'gaps']` key |
| 3. `useSetOwnership` mutation, explicit `{owned}` body, invalidates gap-view + `GET /collection` | `use-collection.ts` CREATE: `useSetOwnership()` |
| 4. Owner view: gap grid, toggle, add-coins panel, remove, rename/delete | `sets/[id]/page.tsx` CREATE, owner-only testids |
| 5. Non-owner view: read-only, no edit controls | `sets/[id]/page.tsx` CREATE, `isOwner` gating |
| 6. `collection-api.ts` typed `getCollection` + `use-collection.ts` hook | `collection-api.ts` CREATE, `use-collection.ts` CREATE |
| 7. `/collection` requires auth, filterable, uses `formatCoinLabel` | `collection/page.tsx` CREATE |
| 8. `useSetOwnership` invalidates both the set's gap key and collection key | `use-collection.ts`'s `useSetOwnership` onSuccess (two `invalidateQueries` calls) |
| 9. Removing a coin doesn't change its ownership | `usePatchSetCoins`'s `remove` only calls `PATCH /sets/:id/coins`, never touches `/collection`; separate mutation, separate invalidation |
| 10. No ad hoc local types duplicating `packages/shared` shapes | Interface Contract's every hook/api signature above is typed directly against `@coin-collector/shared` exports |

## Risks and open questions

- **Deviation from backlog_week3.md's literal file names** (`use-set-coins.ts`,
  `use-gap-view.ts`, `use-ownership.ts`): this plan instead extends the existing
  `use-user-sets.ts` (for `usePatchSetCoins`, reusing `useSetGaps`) and adds one new
  `use-collection.ts` (for `useSetOwnership`/`useCollection`), because Day 3 already
  built `useSetGaps` in `use-user-sets.ts` and the codebase's established convention
  pairs one hooks file per `*-api.ts` file — adding a second, differently-keyed hook
  for the same `GET /sets/:id/gaps` endpoint would risk the two ever drifting out of
  cache-key sync. Flagging this explicitly since it's a deliberate divergence from
  the backlog's literal wording, not an oversight.
- **`useSetOwnership`'s broad `['user-sets']` invalidation** re-fetches every
  currently-mounted set's gap view on any single ownership toggle, not just the one
  being edited. This is correct per PRD requirement 13 (global ownership visibility)
  and matches this codebase's existing convention (`useCreateSet`/`useRenameSet`/`useDeleteSet`
  all already invalidate the broad `['user-sets']` prefix rather than a narrow key),
  but is worth the Coder double-checking against a real multi-set scenario if the
  sandbox test asserts on call counts rather than just presence.
- **Test command reminder for Stage 6:** `repo-digest.md`'s Test command has already
  been corrected to `pnpm --filter @coin-collector/shared build && pnpm --filter web test`
  per `memory.md`'s recurring gotcha about this exact monorepo. No `packages/shared/src`
  changes are planned this task, but the build step is required regardless (same
  gotcha: it recurred even on a task that didn't touch `packages/shared/src`).
