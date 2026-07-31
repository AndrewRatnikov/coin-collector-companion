# PRD: Set editor + gap view + collection page (backlog_week3.md Day 4)

**Run:** run_20260721_171115
**Date:** 2026-07-21

## Goal

A logged-in coin collector who has created or cloned a set (Day 3) currently has
nowhere to actually work the set: add coins to it, mark coins as owned, see how
complete the set is, or see their full ownership list across all sets. Day 4 builds
that editor surface — the set detail/editor page with a gap-view grid, an "add coins"
panel, remove/rename/delete actions, and a global `/collection` page — so ownership
data entered anywhere is immediately reflected everywhere it's shown (per set and
globally), matching the API's already-idempotent ownership contract
(`PATCH /collection/:coinId`, SD §2.3/§4.1).

## User stories

- As a set owner, I want to see my set's coins with owned/missing status and overall
  completion %, so I know how close I am to finishing it.
- As a set owner, I want to toggle a coin's owned status directly from the set editor,
  so marking progress doesn't require leaving the page.
- As a set owner, I want to add coins to my set using the same filter tool I use to
  browse the catalog, so picking coins is familiar and fast.
- As a set owner, I want to remove a coin from my set without losing its ownership
  status elsewhere, so cleaning up a set doesn't cost me collection history.
- As a set owner, I want to rename or delete my set, so I can manage it as my
  collection evolves.
- As any logged-in user, I want to view my full ownership list filtered by
  country/year, so I can see my whole collection in one place regardless of which
  set(s) a coin belongs to.
- As a logged-in user viewing someone else's set, I want a read-only gap view (no
  edit controls), so I can preview a set before deciding to clone it.

## Acceptance criteria

1. `apps/web/src/lib/hooks/use-set-coins.ts` exports `usePatchSetCoins`, a mutation
   wrapping `PATCH /sets/:id/coins` (`PatchSetCoinsRequest { add?, remove? }`), that
   invalidates that set's `UserSetDetail` query and gap-view query on success.
2. A query hook wrapping `GET /sets/:id/gaps` (returns `GapViewResponse`) is available
   to the set editor, keyed so it can be invalidated by both criterion 1's mutation
   and criterion 3's ownership mutation. Day 3 already built exactly this
   (`useSetGaps` in `apps/web/src/lib/hooks/use-user-sets.ts`, queryKey
   `['user-sets', id, 'gaps']`, already consumed by `/dashboard` and
   `/sets/public/[id]`) — reuse it rather than adding a second, differently-keyed
   hook for the same endpoint.
3. `apps/web/src/lib/hooks/use-ownership.ts` exports `useSetOwnership`, a mutation
   wrapping `PATCH /collection/:coinId` with an explicit `{ owned: boolean }` body
   (`SetOwnershipRequest`) — never a client-side toggle of a locally-held boolean —
   that invalidates the current set's gap-view query AND the `GET /collection` query
   on success (ownership is global: a coin marked owned in one set must show owned
   in every other set and on `/collection` immediately, without a manual refresh).
4. `apps/web/src/app/sets/[id]/page.tsx` exists and, for the set's owner (authenticated,
   `userId` matches), renders:
   - a gap-view grid (one card/row per `GapSlot`, showing owned/missing status,
     the coin's `formatCoinLabel`, and the set's `completionPercent`)
   - click-to-toggle owned status per slot, wired to criterion 3's mutation
   - an "Add coins" panel reusing the Day 2 catalog filter form (2.2) to pick coins,
     submitting the picked coin id(s) into `usePatchSetCoins`'s `add` array
   - a remove-coin action per slot, submitting into `usePatchSetCoins`'s `remove` array
   - a rename action (`PATCH /sets/:id`) and a delete action (`DELETE /sets/:id`,
     redirecting to `/dashboard` on success)
5. `apps/web/src/app/sets/[id]/page.tsx`, when loaded by a logged-in user who is NOT
   the set's owner, renders the same gap-view grid read-only: no toggle, add, remove,
   rename, or delete controls are present or reachable.
6. `apps/web/src/lib/collection-api.ts` exports `getCollection`, typed against
   `OwnershipItem[]`/`PaginatedResponse<OwnershipItem>` (matching `GET /collection`'s
   actual response shape) via `apiFetch`; `apps/web/src/lib/hooks/use-collection.ts`
   exports a `useCollection` hook wrapping it.
7. `apps/web/src/app/collection/page.tsx` requires auth (redirects to `/login` when
   logged out, per Day 1's route-protection convention) and renders the current
   user's full ownership list, filterable by country and year, with each row's label
   rendered via `packages/shared`'s `formatCoinLabel` (no local re-implementation of
   the label format).
8. `useSetOwnership` (criterion 3) invalidates both the gap-view query key for the
   current set (`['user-sets', setId, 'gaps']`) and the collection query key on
   success — verified the same way this repo already tests mutation-invalidation
   (`renderHook` + a real `QueryClient` + `vi.spyOn(queryClient, 'invalidateQueries')`,
   asserting both exact query keys), not by rendering two pages against a shared
   client.
9. Removing a coin from a set (criterion 4's remove action) does not change that
   coin's ownership status — a removed-but-previously-owned coin still appears owned
   on `/collection` and in any other set containing it.
10. Every new fetch wrapper (`use-set-coins`, `use-gap-view`, `use-ownership`,
    `collection-api`/`use-collection`) is typed against the existing `packages/shared`
    exports (`GapViewResponse`, `GapSlot`, `PatchSetCoinsRequest`, `SetOwnershipRequest`,
    `SetOwnershipResponse`, `OwnershipItem`) — no new ad hoc local type definitions
    duplicating a shape that already exists there.

## Out of scope

- Any backend/API change — the full `sets`/`collection` API surface (`PATCH /sets/:id/coins`,
  `GET /sets/:id/gaps`, `PATCH /collection/:coinId`, `GET /collection`) already exists
  and is not modified this task.
- Drag-and-drop or manual reordering of coins within a set — `PATCH /sets/:id/coins`
  is append-only server-side; the editor UI must not imply reordering is possible.
- Styling/visual polish pass, top-level navigation, and the full end-to-end manual
  click-through passes — those are Day 5 (backlog_week3.md Day 5), not this task.
- `is_public`/per-set privacy controls — post-MVP, every set stays public.
- Live-DB manual verification (backlog item 4.5's manual pass) — per an existing
  project convention (documented gotcha from a prior run of this pipeline), live-DB
  verification against the real Neon dev database is an out-of-band human step, not
  something the automated Coder/sandbox stages perform; this PRD's acceptance
  criteria are scoped to what an automated test can verify against mocked API calls.

## Open questions

None — backlog_week3.md's Day 4 section (4.1–4.4) fully specifies the files, hooks,
and behavior, and every API endpoint and shared type it depends on already exists
in the repo (verified: `apps/api/src/sets/sets.controller.ts`,
`apps/api/src/collection/collection.controller.ts`, `packages/shared/src/index.ts`).
