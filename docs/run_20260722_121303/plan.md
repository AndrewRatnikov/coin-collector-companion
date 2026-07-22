# Technical Plan: Day 5 — Styling pass, navigation, manual E2E passes, wrap-up

**Run:** run_20260722_121303
**Date:** 2026-07-22

## Summary

Adds one new component (`SiteNav`, an auth-aware top-level navigation bar wired into
the existing root layout) and closes a loading-state gap on five routes that currently
show bare `Loading…` text instead of the app's established `Skeleton`/`ListSkeleton`
primitives. Also adds a human-run Prisma cleanup script for this week's throwaway QA
data. The manual E2E click-through passes (PRD criteria 3–4) and the build/lint/
console-error gate (criterion 5's non-typecheck/lint portion) are **not** automatable
by this pipeline — they're scoped as an explicit post-pipeline checklist, consistent
with how every prior week's "Manual pass" item and this repo's own recorded live-DB-
verification convention (`memory.md`) have been handled.

## Approach

1. **`SiteNav` component** (new) — a `'use client'` component that renders three
   always-visible links (`/catalog`, `/sets/canonical`, `/sets/public`) and an
   auth-conditional right-hand cluster: `/dashboard` + `/collection` + a logout
   button when a token is present, or a `/login` link when it isn't. Auth state is
   read via `getStoredToken()` inside a `useEffect` keyed on `usePathname()` — since
   `localStorage` isn't reactive, re-checking on every route change is what picks up
   a fresh login/logout (both of which navigate via `router.push`/`replace`
   elsewhere in the app, so a path change always follows a token change). No
   "checking" gate is needed here (unlike `RequireAuth`): defaulting to the
   logged-out link set on first render (server-rendered, then client-corrected) is
   the safe direction — it only ever *hides* privileged links a beat late, never
   exposes them early.
2. **Wire into layout** — `apps/web/src/app/layout.tsx` renders `<SiteNav />` as the
   first child inside `<QueryProvider>`, immediately before `{children}`, so it's
   present on every route without touching each page individually. Not unit-tested
   directly (Next.js App Router root layouts mount `<html>/<body>`, which RTL can't
   render standalone) — this mirrors the existing precedent of testing `RequireAuth`
   standalone rather than through a page that uses it.
3. **Loading-state fixes (5 pages)** — each currently renders the literal text
   `Loading…` inside an existing `data-testid` wrapper. Replace the text child with
   `<Skeleton className="h-6 w-48" />` (single-entity detail pages) or
   `<ListSkeleton />` (the one list page in this batch). No testid is added,
   renamed, or removed — only the inner content changes. `sets/[id]/page.tsx`'s
   three `<main data-testid="set-editor-page">` instances in the loading/error/
   null-id branches additionally gain `className="flex flex-1 flex-col gap-6 p-8"`
   to match the className already present on its own success-branch `<main>`.
4. **Root page spacing** — `apps/web/src/app/page.tsx`'s wrapper is missing the
   `p-8` every other route already has; add it for consistency (no testid change).
5. **Cleanup script** (new, `apps/api/scripts/`) — follows the same structural
   convention as the existing `seed-canonical-sets.ts`: pure exported functions
   typed against a narrow `Pick<PrismaClient, ...>` interface (so tests mock it
   without a real DB connection), plus a thin `main()` CLI entrypoint that
   instantiates the real client. Deletes a named user's rows in FK-safe order
   (`Ownership` → that user's `UserSetCoin`s → `UserSet`s → `User`) since
   `UserSet.user` and `Ownership.user` have no `onDelete: Cascade` in
   `schema.prisma` (only `UserSetCoin.userSet` does). Takes explicit email
   arguments rather than a naming-pattern heuristic — there is no established
   "throwaway email" convention anywhere in this repo's history to detect safely,
   and guessing one against a database that also backs the Render prod deployment
   (per `memory.md`) is not a risk worth taking for a wrap-up script.

## Files changed

| File | Action | Purpose |
|------|--------|---------|
| apps/web/src/components/layout/site-nav.tsx | CREATE | Auth-aware top-level nav |
| apps/web/src/app/layout.tsx | MODIFY | Render `SiteNav` inside `QueryProvider`, before `children` |
| apps/web/src/app/catalog/[coinId]/page.tsx | MODIFY | Skeleton in place of bare loading text |
| apps/web/src/app/sets/canonical/page.tsx | MODIFY | ListSkeleton in place of bare loading text |
| apps/web/src/app/sets/canonical/[id]/page.tsx | MODIFY | Skeleton in place of bare loading text |
| apps/web/src/app/sets/public/[id]/page.tsx | MODIFY | Skeleton in place of bare loading text |
| apps/web/src/app/sets/[id]/page.tsx | MODIFY | Skeleton in place of bare loading text + wrapper className on loading/error/null-id branches |
| apps/web/src/app/page.tsx | MODIFY | Add missing `p-8` for spacing consistency |
| apps/api/scripts/cleanup-throwaway-users.ts | CREATE | Human-run Prisma cleanup script (never sandbox-executed) |

## Interface Contract

### Component: SiteNav

- **File:** `apps/web/src/components/layout/site-nav.tsx`
- **Export:** `export function SiteNav()`
- **Props:** none — reads auth state internally.
- **Test selectors:**
  - `data-testid="site-nav"` — root `<nav>` element
  - `data-testid="site-nav-catalog-link"` — always-visible link to `/catalog`
  - `data-testid="site-nav-canonical-link"` — always-visible link to `/sets/canonical`
  - `data-testid="site-nav-public-link"` — always-visible link to `/sets/public`
  - `data-testid="site-nav-dashboard-link"` — link to `/dashboard`, rendered only when authenticated
  - `data-testid="site-nav-collection-link"` — link to `/collection`, rendered only when authenticated
  - `data-testid="site-nav-logout"` — `<button type="button">`, rendered only when authenticated; calls `clearStoredToken()` then `router.push('/login')`
  - `data-testid="site-nav-login-link"` — link to `/login`, rendered only when unauthenticated
- **Dependencies:** `next/link` `Link`; `next/navigation` `usePathname`, `useRouter`; `@/lib/auth-token` `getStoredToken`, `clearStoredToken`.

### Modify: RootLayout

- **File:** `apps/web/src/app/layout.tsx`
- No new exports, props, or testids. Adds `import { SiteNav } from '@/components/layout/site-nav';` and renders `<SiteNav />` as the first child of `<QueryProvider>`, before `{children}`.
- **Not unit-tested** — no `layout.test.tsx` should be created; `SiteNav`'s own test file covers its behavior standalone.

### Modify: Loading-state fixes (existing testids re-declared for contract-check purposes)

No new testids. These already exist in each file today and must keep working exactly as named — restated here only so the mechanical contract gate recognizes them as covered:

- `apps/web/src/app/catalog/[coinId]/page.tsx`: `data-testid="coin-detail-page"`, `data-testid="coin-detail-loading"` (content → `<Skeleton className="h-6 w-48" />`)
- `apps/web/src/app/sets/canonical/page.tsx`: `data-testid="canonical-sets-page"`, `data-testid="canonical-sets-loading"` (content → `<ListSkeleton />`)
- `apps/web/src/app/sets/canonical/[id]/page.tsx`: `data-testid="canonical-set-detail-page"`, `data-testid="canonical-set-detail-loading"` (content → `<Skeleton className="h-6 w-48" />`)
- `apps/web/src/app/sets/public/[id]/page.tsx`: `data-testid="public-set-detail-page"`, `data-testid="public-set-detail-loading"` (content → `<Skeleton className="h-6 w-48" />`)
- `apps/web/src/app/sets/[id]/page.tsx`: `data-testid="set-editor-page"`, `data-testid="set-editor-loading"` (content → `<Skeleton className="h-6 w-48" />`; all three `set-editor-page` `<main>` instances in the loading/error/null-id branches gain `className="flex flex-1 flex-col gap-6 p-8"`)

### Script: cleanup-throwaway-users

- **File:** `apps/api/scripts/cleanup-throwaway-users.ts`
- **Exports:**
  - `export type CleanupPrismaClient = Pick<PrismaClient, 'user' | 'userSet' | 'userSetCoin' | 'ownership'>`
  - `export function parseEmailArgs(argv: string[]): string[]` — throws `new Error('Usage: cleanup-throwaway-users.ts <email> [email...]')` when `argv` is empty; otherwise returns the trimmed, de-duplicated list.
  - `export async function deleteUserCascade(prisma: CleanupPrismaClient, email: string): Promise<{ found: boolean; deletedOwnerships: number; deletedSetCoins: number; deletedSets: number }>` — looks up the user by email; if absent, returns `{ found: false, deletedOwnerships: 0, deletedSetCoins: 0, deletedSets: 0 }` without throwing. If present, deletes in order: `ownership.deleteMany({ where: { userId } })` → `userSetCoin.deleteMany({ where: { userSetId: { in: [...] } } })` (using that user's `userSet.id`s) → `userSet.deleteMany({ where: { userId } })` → `user.delete({ where: { id } })`, returning the row counts deleted at each step.
  - `main()` (not exported) — real CLI entrypoint: instantiates `PrismaClient`, calls `parseEmailArgs(process.argv.slice(2))`, prints before/after `user`/`userSet`/`userSetCoin`/`ownership` counts via `.count()`, then a per-email `deleteUserCascade` summary.
- **No test selectors** — not a UI component.
- **Dependencies:** `@prisma/client`'s `PrismaClient` type only; the real client is instantiated solely inside `main()`, never in a test (mirrors `seed-canonical-sets.ts`'s `SeedPrismaClient` mocking convention already established in this repo).
- **Never sandbox-executed.** The sandbox worktree has no `DATABASE_URL` (`.env` is gitignored) and this script performs real, irreversible deletes against the Neon dev DB that also backs Render prod (per `memory.md`). It ships as code + a mocked-Prisma unit test only; running it for real against the actual throwaway rows from this week's manual passes is a step for the user to run themselves afterward.

## Acceptance criteria coverage

| Criterion | Satisfied by |
|-----------|-------------|
| 1. Consistent styling/skeleton loading states, no bare blank screens | `SiteNav` + the 5 loading-state fixes + the `page.tsx` spacing fix |
| 2. Persistent, auth-aware top-level navigation | `SiteNav` component + `layout.tsx` wiring |
| 3. First-user continuous manual session (browse → sign up → clone → edit → mark owned → gaps/collection update live) | **Manual**, not automatable — run by the user against real dev servers after this pipeline finishes; exercises the already-built Day 1–4 routes plus this run's nav/styling |
| 4. Second-user manual session (find via `/sets/public`, clone, independent 0% gap view) | **Manual**, same as above |
| 5. `typecheck`/`build`/`lint` clean, zero console errors | `typecheck` and `lint` run automatically as part of Stage 6's sandbox Test command; `next build` and the zero-console-errors check have no automated equivalent in this pipeline and are part of the same manual pass as criteria 3–4 |
| 6. Throwaway DB rows removed, row counts confirmed back to baseline | `cleanup-throwaway-users.ts` (code + mocked-Prisma unit test, automated); actual execution against the real dev DB and the row-count confirmation are manual |

## Pre-existing testids (declared for contract-check purposes only)

The 5 loading-state-fix files each already had a `page.test.tsx` with real coverage
from prior Days' runs (own Interface Contracts, not this run's). Per this plan's own
Risks section, the Tester correctly preserved that existing coverage verbatim inside
each file rather than replacing it. None of these are new, modified, or renamed by
this run — they're restated here only so the mechanical contract gate (which greps
this file for every `data-testid="..."` literal, with no knowledge of prior runs'
plan.md contracts) doesn't flag legitimately-preserved pre-existing assertions as
invented:

`data-testid="canonical-set-clone-cta"` `data-testid="canonical-set-coin-item"` `data-testid="canonical-set-coin-list"` `data-testid="canonical-set-detail-description"` `data-testid="canonical-set-detail-error"` `data-testid="canonical-set-detail-name"` `data-testid="canonical-set-item"` `data-testid="canonical-sets-empty"` `data-testid="canonical-sets-error"` `data-testid="canonical-sets-list"` `data-testid="coin-detail-attribution"` `data-testid="coin-detail-country"` `data-testid="coin-detail-denomination"` `data-testid="coin-detail-error"` `data-testid="coin-detail-image"` `data-testid="coin-detail-label"` `data-testid="coin-detail-mint-mark"` `data-testid="coin-detail-variety"` `data-testid="coin-detail-year"` `data-testid="public-set-clone-cta"` `data-testid="public-set-detail-coin-item"` `data-testid="public-set-detail-coin-status"` `data-testid="public-set-detail-error"` `data-testid="public-set-detail-name"` `data-testid="set-editor-add-coins-add-button"` `data-testid="set-editor-add-coins-filter-country"` `data-testid="set-editor-add-coins-filter-form"` `data-testid="set-editor-add-coins-filter-submit"` `data-testid="set-editor-add-coins-panel"` `data-testid="set-editor-completion"` `data-testid="set-editor-delete-button"` `data-testid="set-editor-error"` `data-testid="set-editor-gap-item"` `data-testid="set-editor-gap-status"` `data-testid="set-editor-name"` `data-testid="set-editor-remove-button"` `data-testid="set-editor-rename-form"` `data-testid="set-editor-rename-input"` `data-testid="set-editor-rename-submit"` `data-testid="set-editor-toggle-owned-button"`

## Risks and open questions

- **Test-file overwrite risk:** Stage 3 commits tests via `cp -r runs/{RUN_ID}/tests/. {REPO}/`, which **overwrites** each target file wholesale. Every one of the 5 loading-state fixes touches a page that already has a `page.test.tsx` with existing passing coverage from Days 1–4. The Tester must read each existing test file first and reproduce its full content plus the new skeleton-loading assertions — not write a partial diff — or Days 1–4's coverage for that file is silently lost.
- **Sandbox Test command** (see `repo-digest.md`, corrected this run): `pnpm --filter @coin-collector/shared build && pnpm --filter web typecheck && pnpm --filter web test && pnpm --filter api exec prisma generate && pnpm --filter api test -- cleanup-throwaway-users && pnpm lint`. The `packages/shared` build-before-test step and the `prisma generate` step are both required per `memory.md`'s recorded gotchas for this repo, even though this run doesn't touch `packages/shared/src` or any `Prisma.PrismaClientKnownRequestError` path directly — omitting either produces a false sandbox FAIL, not a real defect. `next build` itself is deliberately excluded from the automated chain to keep the sandbox run inside its 120s budget; it's covered by the manual pass instead. If Stage 6 nonetheless times out, treat the chain length as the first suspect before assuming an unresolved-promise test defect.
- **`SiteNav` test approach:** mock `next/navigation`'s `useRouter` (as `RequireAuth`'s existing test does) and also `usePathname` (returning a fixed string is sufficient — the test doesn't need real route changes, just to control when the auth-check effect re-runs). Use `setStoredToken`/`clearStoredToken` from `@/lib/auth-token` to control the authenticated/unauthenticated branches, per criterion 2.
- **Root-page (`app/page.tsx`) change is out-of-batch cosmetic polish**, not tied to a specific PRD criterion beyond the general "consistent spacing" language in criterion 1 — low risk, one class addition.
