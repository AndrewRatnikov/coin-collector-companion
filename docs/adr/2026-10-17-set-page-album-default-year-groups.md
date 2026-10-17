# The set page defaults to Album and shows both views as year groups, replacing the country/mint-mark album pages

- **Status:** Accepted
- **Date:** 2026-10-17
- **Source:** orchestrator run `run_20261017_210503` (signed-in redesign, Phase 4, Set page; boards `R_Set` / `R_SetMobile`)
- **Code:** `apps/web/src/app/sets/[id]/page.tsx`, `apps/web/src/lib/set-view.ts`, `apps/web/src/lib/set-page.ts`, `apps/web/src/components/sets/set-year-group.tsx`, `apps/web/src/components/sets/set-album.tsx`, `apps/web/src/components/sets/set-coin-list.tsx`
- **Supersedes:** [2026-10-09-album-view-client-side-projection](2026-10-09-album-view-client-side-projection.md) (the List default, `?view=album`, and the page/row/mint-mark-column layout)

## Context

[2026-10-09-album-view-client-side-projection](2026-10-09-album-view-client-side-projection.md) made List the default, stored `?view=album` in the URL, and built the album from `buildAlbumLayout` as pages (country + denomination + name), year rows and mint-mark columns. The Phase 4 boards and brief make Album the default and group coins by year, with a per-year "N of M owned" and "Mark all", in both views. The old layout cannot express per-year Mark all and contradicts the boards.

## Decision

- **Default and URL:** `parseSetView` returns `'list'` only for `view=list`, otherwise `'album'`. `buildSetViewSearch(search, 'list')` sets `view=list`; `'album'` deletes the param and keeps other params. Writing is still `window.history.replaceState`, so reload and shared links keep the view.
- **Grouping:** `buildYearGroups` in `set-page.ts` groups gap slots by `coin.year`, years ascending, slots by `position` within a year. Each group carries owned/total counts, the visible slots (All or Missing filter, where coins that are pending or failed stay visible) and `markableCoinIds`.
- **Rendering:** each group is a `SetYearGroup` (header with year, count, and a desktop-only Mark all button) containing either `SetAlbum` (a grid of `CoinCard`s) or `SetCoinList` (rows). `SetAlbum` no longer renders `buildAlbumLayout` pages; `lib/album-layout.ts` stays because the catalog and the page use parts of it.
- The projection is still client-side from `useSetGaps`; no endpoint is added for it.

## Alternatives considered

- **Keep `buildAlbumLayout` pages and nest them in year groups.** It contradicts the boards, and the brief overrides the older briefs on year headers and set-page layout.
- **Drop the URL param.** It would break shared-link and reload behaviour that the 2026-10-09 ADR established.

## Consequences

- Links `?view=album` still land on Album (the default); links without a param, which used to open List, now open Album. Anyone relying on the old default sees a different view.
- Varieties and mint marks are no longer laid out as table columns; they appear as separate cards or rows within the coin's year.
- Re-adding a removed coin (undo) appends at `max(position) + 1` as before and so returns to the end of its own year group, since groups come from the year, not position.
- The 2026-10-09 ADR's rule that features derive from `useSetGaps` and its `replaceState` caveat still hold.
