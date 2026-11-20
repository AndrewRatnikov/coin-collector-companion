# One presentational WantListTable renders every want list, grouped by country and denomination, then year

- **Status:** Accepted
- **Date:** 2026-11-19
- **Source:** orchestrator run `run_20261119_210926` (want list Phase 1, growth 5.1 and 5.2; `docs/backlog_want-list.md` decisions 1 to 4)
- **Code:** `apps/web/src/components/want-list/want-list-table.tsx`, `apps/web/src/lib/missing-list.ts`, `apps/web/src/app/sets/[id]/missing/page.tsx`, `apps/web/src/components/landing/want-list.tsx`

## Context

The landing page promises a want list "the same" as the one a user's own sets print and export, but the landing card and `/sets/[id]/missing` each had their own table markup. Phase 3 of the want-list backlog adds a combined list, which would have been a third table. Owned coins below a set's minimum grade appeared nowhere on the missing page.

## Decision

- `WantListTable` is a prop-only component: `groups`, `plainLabel`, `variant` (`missing` | `upgrade`), optional `showGroupHeadings` (default: two or more groups) and `className`. One `<table>` per group, one row per year, the mints of a year on one line separated by ` · `, `★` for key dates. The `upgrade` variant appends `(grade → target)` to each mint.
- `buildWantGroups` is the pure function that turns items in the caller's order into `WantGroup[]`: key `country|denomination`, first-appearance order, never sorts or mutates. Mint labels drop the series prefix of a variety (via the now exported `splitCoinVariety` in `packages/shared`).
- The landing card renders its existing `groupWantList` rows through the component as a single group with headings off, so it looks the same. `groupWantList` is kept as is: its labels keep the full variety and its key dates come from `keyDateIds`.
- `/sets/[id]/missing` shows a "Missing" section and, when the set has a minimum grade and `upgradeCount > 0`, an "Upgrade wanted" section. Upgrades are never counted as gaps; completion and counts are unchanged.

## Alternatives considered

- **Restyle the missing page's own table.** Rejected: the landing promise stays untrue and Phase 3 builds a third table.
- **Show upgrades inside the Missing list with a flag.** Rejected: an upgrade is not a gap and completion must not change.
- **Rewrite `groupWantList` on top of `buildWantGroups`.** Rejected: its output and tests would change.

## Consequences

- Any new want list (Phase 3's combined list) should build `WantGroup[]` and render `WantListTable` rather than add markup.
- Two grouping functions exist (`groupWantList`, `buildWantGroups`); they should converge if the landing sample ever uses real catalog data.
- Row test ids (`want-list-row`, `want-list-year`, `want-list-mints`) are shared by the landing card and the page.
