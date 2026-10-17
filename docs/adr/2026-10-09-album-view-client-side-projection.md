# The set Album view is a client-side projection of the gap data, with the view mode kept in the URL

- **Status:** Superseded by [2026-10-17-set-page-album-default-year-groups](2026-10-17-set-page-album-default-year-groups.md)
- **Date:** 2026-10-09 (later refined by `run_20261010_083926` and `run_20261011_095624`; their visual design is in `docs/design/2026-10-10_album-view.md`)
- **Source:** orchestrator run `run_20261009_211156` (Album view on `/sets/[id]`)
- **Code:** `apps/web/src/lib/album-layout.ts` (`buildAlbumLayout`, card-text helpers), `apps/web/src/components/sets/set-album.tsx`, `apps/web/src/app/sets/[id]/page.tsx`

## Context

Collectors think in coin-folder layouts ("I have the 1931 but not the 1931-S"). The gap view is the product's differentiator, and a folder-style grid makes gaps visible at a glance. The data was already there: `GET /sets/:id/gaps` returns every slot with its coin and an `owned` flag.

## Decision

- **Frontend only:** no API, schema or shared-package change. A pure `buildAlbumLayout(slots)` turns the existing `GapSlot[]` into pages (one per country + denomination + name, ordered by the smallest set position), then rows (years present, ascending), then mint-mark columns (`''` first), then cells. A cell can hold several coins (varieties).
- `buildAlbumLayout` **does not trust array order**. It does a stable sort by `position` and never mutates its input.
- **No local copy of ownership.** Toggling reuses `useSetOwnership`, which invalidates the gaps query. The album, page counts and footers are all derived from `gaps.slots` at render time.
- **View mode in the URL:** `?view=album`, written with `window.history.replaceState`, so reload and shared links keep the view. List stays the default, and its behaviour and tests are unchanged.

## Consequences

- Any later album feature should keep deriving from `useSetGaps` rather than adding endpoints.
- **`replaceState` caveat:** Next 16 syncs native history calls into the router. Nothing else on this page reads search params today. If a future change adopts `useSearchParams` here, the page tests' `next/navigation` mocks need it first.
- `useSetOwnership` exposes only the latest `variables`, so a fast double toggle shows only the last coin as busy. This is cosmetic.
