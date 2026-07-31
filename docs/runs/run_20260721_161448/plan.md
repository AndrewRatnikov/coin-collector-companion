# Technical Plan: Public sets, dashboard, set creation (backlog_week3.md Day 3)

**Run:** run_20260721_161448
**Date:** 2026-07-21

## Summary

Adds the user-sets/public-sets client layer (`user-sets-api.ts`, `public-sets-api.ts` + their TanStack Query hooks) and three routes to `apps/web`: `/sets/public` (paginated public-set list), `/sets/public/[id]` (detail, with an authenticated gap preview and a "Clone into my sets" CTA matching the one already built on `/sets/canonical/[id]` in Day 2), and `/sets/new` (the single entry point for all three set-creation paths). `dashboard/page.tsx` is upgraded from Day 1's placeholder to a real listing of the user's own sets with per-set completion %. Every new page follows the exact shape Days 1-2 already established: `'use client'` components, `data-testid` on every meaningful element, the `useEffect`+`useState` pattern (not `use()`) for unwrapping dynamic-route `params` per the gotcha recorded from Day 2, and `getStoredToken()` gating clone CTAs.

## Approach

- **`user-sets-api.ts`** wraps `apiFetch` for `GET /sets` (→ `UserSetSummary[]`, confirmed against `apps/api/src/sets/sets.controller.ts` — **not paginated**, same shape as `canonical-sets-api.ts`'s list call), `POST /sets` (`CreateSetRequestBody` → `UserSetSummary`), `PATCH /sets/:id` (rename, `{ name }` → `UserSetSummary`), `DELETE /sets/:id` (→ `void`), and `GET /sets/:id/gaps` (→ `GapViewResponse`, confirmed **not owner-restricted** per the controller's own doc comment — any authenticated caller can preview gaps against any set).
  - **Deviation from a literal reading of backlog 3.1 / PRD criterion 1:** `sets.controller.ts` has no `GET /sets/:id` route at all (only `GET /sets` (list), `GET /sets/:id/gaps`, `PATCH /sets/:id`, `DELETE /sets/:id`). A `getUserSet(id): Promise<UserSetDetail>` function would call a non-existent endpoint. Per this repo's own established rule ("Any backend/API change... if a UI need surfaces a real API gap, that's a scope bug... to flag, not something to quietly patch in"), this plan does **not** add a `getUserSet` export and does not add a backend route. No Day 3 page needs single-set-detail-by-plain-fetch: the dashboard uses the list endpoint's summaries, and `/sets/new` never fetches an existing user-owned set. Flagged in Risks below for whoever architects Day 4 (the set editor, which will need *some* way to load one set's coins — likely satisfied by `/sets/:id/gaps` alone, since `GapSlot` already carries `coin`+`position`+`owned`).
- **`public-sets-api.ts`** wraps `GET /sets/public` (`page`/`limit` query params per `FindPublicSetsQueryDto`, → `PaginatedResponse<UserSetSummary>`, same `PaginatedResponse` pattern `catalog-api.ts` already uses) and `GET /sets/public/:id` (→ `UserSetDetail`).
- **`use-user-sets.ts`**: `useUserSets()` (list query), `useSetGaps(id)` (single gap-view query, key `['user-sets', id, 'gaps']` — deliberately the same key shape the dashboard's `useQueries` call below constructs, so both share one cache entry per set), `useCreateSet()`/`useRenameSet()`/`useDeleteSet()` mutations, each invalidating `['user-sets']` on success. Rename/delete are not called from any Day 3 page (that's Day 4's editor) but are independently unit-testable per backlog 3.1's explicit ask for the full client surface up front.
- **`use-public-sets.ts`**: `usePublicSets(filters)`, `usePublicSet(id)` — same shape as `use-catalog.ts`.
- **`sets/public/page.tsx`**: same Prev/Next pagination structure as `catalog/page.tsx` (state-held `page`, `PaginatedResponse`'s `page`/`limit`/`total` driving button `disabled`), no filter form (the endpoint takes no filters beyond `page`/`limit`). Each row links to `/sets/public/[id]`.
- **`sets/public/[id]/page.tsx`**: same `useEffect`+`useState` params-unwrap pattern as `sets/canonical/[id]/page.tsx` (not `use()` — Day 2's recorded gotcha applies to every dynamic route in this app). Always renders `set.coins` (sorted by `position`) via `formatCoinLabel`, the same base list an anonymous visitor sees. When `getStoredToken()` is truthy, additionally calls `useSetGaps(id)`; once that query resolves successfully, each coin row also renders an owned/missing status badge looked up by matching `coin.id` against `gapsQuery.data.slots`. If the gaps query errors (`403`/`404`/`500`) or the visitor has no token, the status badge is simply omitted from every row — the base coin list still renders regardless, satisfying PRD criterion 6's "does not block the base coin list" requirement. A "Clone into my sets" CTA (`/sets/new?cloneFrom=user&cloneFromId={id}`) is present only when logged in, identical gating to the canonical page's own CTA.
- **`sets/new/page.tsx`**: reads `cloneFrom`/`cloneFromId` from `useSearchParams()` (`next/navigation`) on mount to set the initial mode and pre-selected source id (`cloneFrom=canonical` → mode `canonical`; `cloneFrom=user` → mode `public`; otherwise mode `blank`). A single required name text input is always visible (`create-set.dto.ts`'s `CreateSetDto.name` is required even when cloning — the name is for the user's own copy, not inherited from the source). Below it, a three-way mode selector; `canonical` mode shows a `<select>` populated from `useCanonicalSets()` (existing Day 2 hook — reused, not reimplemented); `public` mode shows a `<select>` populated from `usePublicSets({ page: 1, limit: 50 })` (first-page picker, matching the backlog's "reachable... via a picker" language — deeper search/pagination inside the picker itself is a Coder-discretion nicety, not a hard requirement, see Risks). On submit, builds the `CreateSetRequestBody` (`{ name }` for blank, `{ name, cloneFrom: { type, id } }` for the other two) and calls `useCreateSet()`'s mutation; on success, `router.push(`/sets/${result.id}`)`; on failure, the caught `ApiError`'s message renders inline (no navigation, no thrown/unhandled exception).
- **`dashboard/page.tsx`** (MODIFY, replacing the Day 1 placeholder that already exists behind `RequireAuth`): calls `useUserSets()` for the set list, then `useQueries` (from `@tanstack/react-query`, imported directly rather than via a new hook — the dashboard is the only Day 3 caller that needs a *dynamic list* of gap-view queries) to fetch `getSetGaps(set.id)` per set in parallel, using the identical query key shape `['user-sets', set.id, 'gaps']` `useSetGaps` uses, so the cache is shared if a user later visits that set's own page. Renders each set's name (linking to `/sets/[id]`, which Day 4 builds) with its `completionPercent` once that set's gap query resolves (an em-dash placeholder while pending). Zero sets renders an empty state pointing at `/sets/new` instead of an empty list. Stays wrapped in `RequireAuth`, unchanged from Day 1.
- No route in this task is added to any central auth-gate list — `/sets/public` and `/sets/public/[id]` are anonymous-accessible (no `RequireAuth`), `/dashboard` (already gated) and `/sets/new` (newly gated) each import `RequireAuth` directly, matching the per-page-wrapper convention already established (there is still no central route-list file).

## Files changed

| File | Action | Purpose |
|------|--------|---------|
| `apps/web/src/lib/user-sets-api.ts` | CREATE | `getUserSets`/`createSet`/`renameSet`/`deleteSet`/`getSetGaps` wrapping `apiFetch` |
| `apps/web/src/lib/hooks/use-user-sets.ts` | CREATE | `useUserSets`/`useSetGaps`/`useCreateSet`/`useRenameSet`/`useDeleteSet` TanStack Query hooks |
| `apps/web/src/lib/public-sets-api.ts` | CREATE | `getPublicSets`/`getPublicSet` wrapping `apiFetch` |
| `apps/web/src/lib/hooks/use-public-sets.ts` | CREATE | `usePublicSets`/`usePublicSet` TanStack Query hooks |
| `apps/web/src/app/sets/public/page.tsx` | CREATE | Paginated public-sets list |
| `apps/web/src/app/sets/public/[id]/page.tsx` | CREATE | Public set detail + auth-gated gap preview + clone CTA |
| `apps/web/src/app/sets/new/page.tsx` | CREATE | Blank/clone-canonical/clone-public set creation form |
| `apps/web/src/app/dashboard/page.tsx` | MODIFY | Replace Day 1 placeholder with real set list + completion % + empty state |

## Interface Contract

### Module: user-sets-api
- **File:** `apps/web/src/lib/user-sets-api.ts`
- **Exports:**
  ```typescript
  export function getUserSets(): Promise<UserSetSummary[]>;
  export function createSet(body: CreateSetRequestBody): Promise<UserSetSummary>;
  export function renameSet(id: string, name: string): Promise<UserSetSummary>;
  export function deleteSet(id: string): Promise<void>;
  export function getSetGaps(id: string): Promise<GapViewResponse>;
  ```
- **Behavior:** `getUserSets` → `apiFetch<UserSetSummary[]>('/sets')`. `createSet` → `apiFetch<UserSetSummary>('/sets', { method: 'POST', body: JSON.stringify(body) })`. `renameSet` → `apiFetch<UserSetSummary>(\`/sets/${id}\`, { method: 'PATCH', body: JSON.stringify({ name }) })`. `deleteSet` → `apiFetch<void>(\`/sets/${id}\`, { method: 'DELETE' })`. `getSetGaps` → `apiFetch<GapViewResponse>(\`/sets/${id}/gaps\`)`.
- **Dependencies:** `apiFetch` from `./api-client`; `CreateSetRequestBody`/`GapViewResponse`/`UserSetSummary` from `@coin-collector/shared`.

### Module: use-user-sets hooks
- **File:** `apps/web/src/lib/hooks/use-user-sets.ts`
- **Exports:**
  ```typescript
  export function useUserSets(): UseQueryResult<UserSetSummary[]>;
  export function useSetGaps(id: string): UseQueryResult<GapViewResponse>;
  export function useCreateSet(): UseMutationResult<UserSetSummary, ApiError, CreateSetRequestBody>;
  export function useRenameSet(): UseMutationResult<UserSetSummary, ApiError, { id: string; name: string }>;
  export function useDeleteSet(): UseMutationResult<void, ApiError, string>;
  ```
- **Behavior:** `useUserSets` — `useQuery({ queryKey: ['user-sets'], queryFn: getUserSets })`. `useSetGaps` — `useQuery({ queryKey: ['user-sets', id, 'gaps'], queryFn: () => getSetGaps(id), enabled: Boolean(id) })`. Each mutation calls its `user-sets-api.ts` function and, `onSuccess`, calls `queryClient.invalidateQueries({ queryKey: ['user-sets'] })`.
- **Dependencies:** `useMutation`/`useQuery`/`useQueryClient` from `@tanstack/react-query`; everything from `@/lib/user-sets-api`.

### Module: public-sets-api
- **File:** `apps/web/src/lib/public-sets-api.ts`
- **Exports:**
  ```typescript
  export interface PublicSetsFilters {
    page?: number;
    limit?: number;
  }
  export function getPublicSets(filters?: PublicSetsFilters): Promise<PaginatedResponse<UserSetSummary>>;
  export function getPublicSet(id: string): Promise<UserSetDetail>;
  ```
- **Behavior:** `getPublicSets` builds a query string from defined `page`/`limit` values, calls `apiFetch<PaginatedResponse<UserSetSummary>>(\`/sets/public${qs}\`)`. `getPublicSet` → `apiFetch<UserSetDetail>(\`/sets/public/${id}\`)`.
- **Dependencies:** `apiFetch` from `./api-client`; `PaginatedResponse`/`UserSetDetail`/`UserSetSummary` from `@coin-collector/shared`.

### Module: use-public-sets hooks
- **File:** `apps/web/src/lib/hooks/use-public-sets.ts`
- **Exports:**
  ```typescript
  export function usePublicSets(filters: PublicSetsFilters): UseQueryResult<PaginatedResponse<UserSetSummary>>;
  export function usePublicSet(id: string): UseQueryResult<UserSetDetail>;
  ```
- **Behavior:** `usePublicSets` — `useQuery({ queryKey: ['public-sets', filters], queryFn: () => getPublicSets(filters) })`. `usePublicSet` — `useQuery({ queryKey: ['public-sets', id], queryFn: () => getPublicSet(id), enabled: Boolean(id) })`.
- **Dependencies:** `useQuery` from `@tanstack/react-query`; everything from `@/lib/public-sets-api`.

### Component: PublicSetsPage
- **File:** `apps/web/src/app/sets/public/page.tsx`
- **Export:** `export default function PublicSetsPage()`
- **Props:** none
- **Test selectors:**
  - `data-testid="public-sets-page"` — root `<main>`
  - `data-testid="public-sets-loading"` — shown while loading (wraps `ListSkeleton`)
  - `data-testid="public-sets-error"` — shown on query error
  - `data-testid="public-sets-list"` — `<ul>` wrapping result rows
  - `data-testid="public-set-item"` — repeated per set (`getAllByTestId`); links to `/sets/public/${set.id}`, text includes `set.name`
  - `data-testid="public-sets-empty"` — shown when `data.items.length === 0`
  - `data-testid="public-sets-pagination"` — wraps the Prev/Next controls
  - `data-testid="public-sets-page-prev"` — Prev button, `disabled` when `data.page <= 1`
  - `data-testid="public-sets-page-next"` — Next button, `disabled` when `data.page * data.limit >= data.total`
  - `data-testid="public-sets-page-indicator"` — text containing `data.page`
- **Dependencies:** `usePublicSets` from `@/lib/hooks/use-public-sets`; `Link` from `next/link`; `ListSkeleton` from `@/components/ui/list-skeleton`.

### Component: PublicSetDetailPage
- **File:** `apps/web/src/app/sets/public/[id]/page.tsx`
- **Export:** `export default function PublicSetDetailPage({ params }: { params: Promise<{ id: string }> })`
- **Props:** `params: Promise<{ id: string }>` — unwrapped via `useEffect`+`useState` (`params.then((resolved) => setId(resolved.id))`), **not** `use()`, matching the fix already applied to `sets/canonical/[id]/page.tsx`.
- **Test selectors:**
  - `data-testid="public-set-detail-page"` — root `<main>`
  - `data-testid="public-set-detail-loading"` — shown while the base set query is loading
  - `data-testid="public-set-detail-error"` — shown when the base set query errors
  - `data-testid="public-set-detail-name"` — set name
  - `data-testid="public-set-clone-cta"` — present in the DOM only when `getStoredToken()` is truthy; links to `/sets/new?cloneFrom=user&cloneFromId=${id}`
  - `data-testid="public-set-detail-coin-list"` — `<ul>` wrapping the ordered coin list (sorted by `position`)
  - `data-testid="public-set-detail-coin-item"` — repeated per coin (`getAllByTestId`); text includes `formatCoinLabel(item.coin)`
  - `data-testid="public-set-detail-coin-status"` — nested inside a coin item; rendered **only** when logged in **and** the gaps query has resolved successfully; text content is exactly `"owned"` or `"missing"` per that coin's matching `GapSlot.owned`; absent from every row when logged out, or when the gaps query is loading/erroring
- **Dependencies:** `usePublicSet` from `@/lib/hooks/use-public-sets`; `useSetGaps` from `@/lib/hooks/use-user-sets`; `formatCoinLabel` from `@coin-collector/shared`; `getStoredToken` from `@/lib/auth-token`; `Link` from `next/link`.

### Component: NewSetPage
- **File:** `apps/web/src/app/sets/new/page.tsx`
- **Export:** `export default function NewSetPage()`
- **Props:** none (query params read via `useSearchParams()`)
- **Test selectors:**
  - `data-testid="set-new-page"` — root `<main>` (rendered inside `RequireAuth`)
  - `data-testid="set-new-name-input"` — the required name text input, always visible
  - `data-testid="set-new-mode-blank"` / `data-testid="set-new-mode-canonical"` / `data-testid="set-new-mode-public"` — radio inputs (`name="set-new-mode"`) selecting the creation path; initial `checked` value derived from `?cloneFrom=` (`canonical`→canonical, `user`→public, absent/other→blank)
  - `data-testid="set-new-canonical-select"` — `<select>` of canonical sets (from `useCanonicalSets()`), rendered only when mode is `canonical`; initial `value` set to `?cloneFromId=` when `?cloneFrom=canonical`
  - `data-testid="set-new-public-select"` — `<select>` of public sets (from `usePublicSets({ page: 1, limit: 50 })`), rendered only when mode is `public`; initial `value` set to `?cloneFromId=` when `?cloneFrom=user`
  - `data-testid="set-new-submit"` — submit button
  - `data-testid="set-new-error"` — page-level error text, rendered only after a failed `createSet` call; contains the thrown `ApiError`'s message
- **Behavior:** submit builds `{ name }` (mode `blank`) or `{ name, cloneFrom: { type: 'canonical' | 'user', id: selectedId } }` (other modes) and calls `useCreateSet()`'s mutate function; `onSuccess` → `router.push(\`/sets/${result.id}\`)`; `onError` → sets the text rendered by `set-new-error`, no navigation.
- **Dependencies:** `useCreateSet` from `@/lib/hooks/use-user-sets`; `useCanonicalSets` from `@/lib/hooks/use-canonical-sets` (existing, Day 2); `usePublicSets` from `@/lib/hooks/use-public-sets`; `useSearchParams`/`useRouter` from `next/navigation`; `RequireAuth` from `@/components/auth/require-auth`.

### Component: DashboardPage (MODIFY)
- **File:** `apps/web/src/app/dashboard/page.tsx`
- **Export:** `export default function DashboardPage()` (unchanged signature; still wrapped in `RequireAuth`)
- **Test selectors:**
  - `data-testid="dashboard-page"` — root `<main>` (already exists — unchanged testid, new content inside it)
  - `data-testid="dashboard-loading"` — shown while `useUserSets()` is loading (wraps `ListSkeleton`)
  - `data-testid="dashboard-error"` — shown when `useUserSets()` errors
  - `data-testid="dashboard-empty"` — shown when the resolved set list has length 0
  - `data-testid="dashboard-new-set-cta"` — link to `/sets/new`, rendered inside the empty state
  - `data-testid="dashboard-set-list"` — `<ul>` wrapping set rows, rendered when length > 0
  - `data-testid="dashboard-set-item"` — repeated per set (`getAllByTestId`); links to `/sets/${set.id}`, text includes `set.name`
  - `data-testid="dashboard-set-completion"` — nested inside each `dashboard-set-item`; text is `` `${completionPercent}%` `` once that set's `useQueries` entry resolves, otherwise `"—"` while pending
- **Dependencies:** `useUserSets` from `@/lib/hooks/use-user-sets`; `getSetGaps` from `@/lib/user-sets-api` (called directly inside `useQueries`, not through `useSetGaps`, since the query list is dynamic); `useQueries` from `@tanstack/react-query`; `RequireAuth` (existing); `ListSkeleton` (existing); `Link` from `next/link`.
- **Existing test file note:** `apps/web/src/app/dashboard/page.test.tsx` currently tests only the Day 1 placeholder's `RequireAuth` gating. The Tester replaces this file's contents entirely (still covering the auth-redirect behavior, now against the real dashboard content) rather than appending to it.

## Acceptance criteria coverage

| Criterion | Satisfied by |
|-----------|-------------|
| 1. `user-sets-api.ts` exports (minus `getUserSet` — see Approach/Risks for the flagged API gap) | Module: user-sets-api |
| 2. `public-sets-api.ts` exports `getPublicSets`/`getPublicSet` | Module: public-sets-api |
| 3. `use-user-sets.ts`/`use-public-sets.ts` hooks with mutation invalidation | Module: use-user-sets hooks; Module: use-public-sets hooks |
| 4. `/sets/public` paginated list, no auth | Component: PublicSetsPage |
| 5. `/sets/public/[id]` anonymous base detail | Component: PublicSetDetailPage |
| 6. Authenticated gap preview on `/sets/public/[id]`, gaps-fetch failure doesn't block base list | Component: PublicSetDetailPage (`public-set-detail-coin-status` behavior) |
| 7. "Clone into my sets" CTA on both canonical (existing, Day 2) and public detail pages, auth-gated, pre-fills `/sets/new` | Component: PublicSetDetailPage (`public-set-clone-cta`); `sets/canonical/[id]/page.tsx` already satisfies its half (unchanged) |
| 8. `/dashboard` requires auth, lists sets with completion % | Component: DashboardPage |
| 9. `/dashboard` empty state with CTA | Component: DashboardPage (`dashboard-empty`/`dashboard-new-set-cta`) |
| 10. `/sets/new` requires auth, three creation paths in one flow | Component: NewSetPage |
| 11. `/sets/new` pre-selects clone source from CTA query params | Component: NewSetPage (initial mode/select value derived from `useSearchParams()`) |
| 12. Successful creation redirects to `/sets/[id]` | Component: NewSetPage (`onSuccess` behavior) |
| 13. Creation failure surfaces inline, no navigation | Component: NewSetPage (`set-new-error`) |
| 14. Manual pass (backlog 3.5) | Out-of-band manual verification after Stage 6 passes — not automated (matches this repo's established convention of manual passes for backlog checkpoints, e.g. Day 2's 2.5) |

## Risks and open questions

- **`getUserSet`/`GET /sets/:id` gap:** flagged above rather than silently added. If Day 4's Architect finds the set editor genuinely needs a plain (non-gap) single-set fetch — e.g. to get `name` before the gap-view query resolves, or to support a set with zero coins where `slots` would be empty either way — that's the moment to either add the missing backend route (a real, scoped backend change, unlike this week's frontend-only mandate) or confirm `GapViewResponse` alone is sufficient (it already carries everything but the bare set `name`/`id`, which `UserSetSummary` from the existing `useUserSets()` list cache can supply instead).
- **`/sets/new`'s public-set picker is first-page-only (`limit: 50`)**: if a real test account's public-set count exceeds 50, the picker won't list everything. Acceptable for this task (the backlog's own manual pass in 3.5 only involves two throwaway users' sets); a search/paginated picker is Coder-discretion future work, not required here.
- **Dashboard's `useQueries` per-set gap fetch** re-fetches every set's full gap view just to read `completionPercent`. The PRD's own criterion 8 already anticipates this ("or a lighter-weight summary if fetching full gap views for every dashboard row proves wasteful — decide based on how many sets a real test account actually has, not preemptively") — this plan takes the direct approach since Day 3's real test accounts are expected to have only a handful of sets; if the manual pass surfaces real slowness, that's a signal to introduce a lighter endpoint, not something to preempt here.
- **`set-new-public-select`/`set-new-canonical-select` when the pre-filled `cloneFromId` isn't present in the fetched list** (e.g. a canonical set count that would require pagination, or a public set outside the first 50): the `<select>`'s initial value simply won't match any `<option>` and renders unselected — the user can still pick manually. Not treated as a bug for this task.
