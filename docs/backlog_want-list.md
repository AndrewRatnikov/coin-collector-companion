# Want list backlog: the gap list you take to a show

Source: growth backlog Step 5, items 5.1–5.3 ([backlog_growth.md](backlog_growth.md)), planned 2026-11-18. 5.4–5.6 (install to a phone, offline, offline marking) are a later backlog.

## Why now

- **The landing page makes a promise the app doesn't keep yet.** Its want list says "The same list your own sets print and export" (`landing.wantNote`). But a real set's `/sets/[id]/missing` page is a flat, pre-redesign table (gray `border-gray-300` cells, one row per coin), and `groupWantList` is used only on the landing page.
- **Coins below a set's minimum grade are invisible on the missing page.** `getMissingSlots` keeps only unowned slots, so an owned 1914-D in Fine, in a set with a VF minimum, appears nowhere on the printed list.
- **The dashboard tile is inconsistent.** "Coins still missing across your sets" shows a deduplicated count across all sets, but its "See what to look for" link opens the missing page of one set (the closest to complete).
- The competitor check ranks a year-and-mint-mark want list as the feature collectors of the big catalogues ask for most and build by hand ([competitor-analysis.md](competitor-analysis.md)).

## Decisions

1. **One list format everywhere.** The landing sample, a real set's missing page and the combined list all render through one presentational component, `WantListTable`, so "the same list" is literally true.
2. **Group, then year.** Rows are grouped by coin type, meaning `(country, denomination)`, then by year, with the mints of a year on one line: `1914: D ★ · S`. When the list has a single group (most single-series sets, and the landing sample), the group heading is hidden.
3. **Mint label:** the mint mark plus the *design* part of `variety` (the part after a "Series: " prefix), joined with a space: `S VDB`, `Donetsk Oblast`. Empty → "(plain)". Export `splitCoinVariety` from `packages/shared` for this rather than re-parsing.
4. **Upgrade wanted is a second section, never a gap.** It lists owned coins whose `needsUpgrade` is true, with their current grade and the target (`F → VF`; ungraded shows "no grade → VF"). Completion and counts don't change, per the PRD's grading rule.
5. **The per-set list stays computed in the browser** from `GET /sets/:id/gaps`, as today ([ADR 2026-10-01](adr/2026-10-01-missing-list-built-in-the-browser.md)). **The combined list is computed on the server** in one new endpoint, because the browser would otherwise call `/gaps` once per set. Record this in a new ADR.
6. **CSV keeps its first eight columns** and gains columns at the end, so existing spreadsheets still line up. Grades in CSV are the codes (`G`…`UNC`).
7. **No schema change, no migration.**

---

## Phase 1: Per-set want list (web only; 5.1, 5.2)

### Shared pieces

- [x] 1.1 `packages/shared`: export `splitCoinVariety` (already used inside `getCoinName`), with a unit test for the "Series: Design" and no-prefix cases.
- [x] 1.2 `apps/web/src/lib/missing-list.ts`: add `buildWantGroups(items)`:
  - input: `{ coin: CatalogCoin; grade?: CoinGrade | null; targetGrade?: CoinGrade | null }[]`, already in the caller's order;
  - output: `WantGroup[]`, where `WantGroup = { key, country, denomination, years: WantListYear[] }` and each `WantListMint` gains optional `grade` and `targetGrade`;
  - groups and years appear in order of first appearance, mints within a year in input order; never mutates the input.
  - Keep `groupWantList`'s signature and output **unchanged** (the landing page and its tests use it); it may delegate to `buildWantGroups` and flatten. (Done: it stays its own function, because it keeps the full variety and takes key dates from `keyDateIds`; the landing card wraps its rows in one group for `WantListTable`.)
  - Add `getUpgradeSlots(gaps)`: owned slots with `needsUpgrade === true`, by position.
- [x] 1.3 New `components/want-list/want-list-table.tsx` (`WantListTable`): props `groups`, `showGroupHeadings` (default: `groups.length > 1`), `plainLabel`, `variant: 'missing' | 'upgrade'`.
  - Visual: exactly the table in today's `components/landing/want-list.tsx` (mono 13px, year column 64px, mints joined with " · ", dashed `neutral-300` row rules, ★ after key dates). Group headings: Plex Sans 13px/500, `neutral-800`, "Ukraine · 10 Kopiyok", with 12px space above.
  - In `upgrade`, each mint renders `label (F → VF)`, with the grades in their existing localized labels (the `grade` area).
  - Keep the landing test ids on rows (`want-list-row`, `want-list-year`, `want-list-mints`, `data-year`) so the landing tests stay green.
- [x] 1.4 `components/landing/want-list.tsx` renders its rows through `WantListTable` (one group, headings hidden). No visible change; its existing tests must pass unchanged.

### The missing page

- [x] 1.5 Rewrite the body of `app/sets/[id]/missing/page.tsx` in the Classical style (tokens only; the gray and red utility classes go). Keep `RequireAuth`, the data hooks, and the test ids `set-missing-page`, `set-missing-loading`, `set-missing-error`, `set-missing-title`, `set-missing-summary`, `set-missing-date`, `set-missing-print-button`, `set-missing-empty`.
  - **Header:** a "‹ {set name}" link back to `/sets/{id}`; `h1` "Want list" (Cormorant); under it the set name, the summary ("16 of 24 owned · 67%", numbers in mono) and the date. On the right, **Print** and **Download CSV** (the second is new here; it calls `downloadMissingCsv`).
  - **Missing section:** `h2` "Missing" with the count in mono, then `WantListTable variant="missing"`.
  - **Upgrade wanted section** (only when the set has a `minGrade` and `upgradeCount > 0`): `h2` "Upgrade wanted" with the count and a one-line note "Owned, but below this set's minimum grade ({grade}).", then `WantListTable variant="upgrade"`.
  - The "★ = key date" legend once, under the last section.
  - **Empty states:** nothing missing and nothing to upgrade → today's `missingList.empty` text plus a link back to the set; nothing missing but upgrades exist → the Missing section shows "Nothing missing." and the upgrade section still shows.
  - **Phone width (390px):** one column, buttons full width, the mints wrap under the year rather than overflowing. Pending manual pass on a real phone-width browser.
  - **Print:** wrap the printable part in `data-print-region` so the existing print rule (`body:has([data-print-region])`) prints only the list; the back link and buttons don't print. Check `print-styles.test.ts` still passes unchanged. Print preview: pending manual pass.
  - The old `set-missing-table`, `set-missing-row`, `set-missing-cell-*` and `set-missing-key-date` test ids go with the old table; update the page tests that used them.
- [x] 1.6 CSV (`buildMissingCsv`): rows in want-list order (groups, then years), missing rows first, then upgrade rows. The header gains three columns at the end: `Want,Grade,Target grade` (`missing` or `upgrade`; grade codes; empty for missing rows). Update `MISSING_CSV_HEADER` and its tests. The set page's ⋯ menu "Download missing" uses the same function, so it changes too; its label stays.
- [x] 1.7 i18n in the `sets` area, EN and ES together: `missingList.title` ("Want list"), `missingList.backToSet`, `missingList.sectionMissing`, `missingList.sectionUpgrade`, `missingList.upgradeNote`, `missingList.nothingMissing`, `missingList.downloadCsv`, `missingList.plain`, `missingList.keyLegend`, `missingList.noGrade`. Remove keys the page no longer uses (`missingList.colKeyDate`, and `missingList.keyDateBadge` if unused elsewhere).

### Tests

- [x] 1.8 `missing-list.test.ts`: `buildWantGroups` (two denominations in one year stay in separate groups; series prefix stripped from labels; plain coins; order of first appearance; no mutation), `getUpgradeSlots`, and the new CSV order and columns.
- [x] 1.9 `want-list-table.test.tsx`: headings hidden for one group and shown for two; upgrade rendering with and without a current grade; key-date star.
- [x] 1.10 Missing page tests: grouped rows for a mixed-denomination set; the upgrade section appears only with a `minGrade` and upgrades; both empty states; Download CSV calls `downloadMissingCsv`; the back link.

**Checkpoint:** a real set prints and exports the same grouped list the landing page shows, and coins below the set's minimum grade are on it under "Upgrade wanted".

## Phase 2: Combined want list API (5.3, server side)

- [x] 2.1 `packages/shared`: `WantListResponse = { setCount: number; missing: WantCoin[]; upgrades: UpgradeWant[] }`, with `WantCoin = { coin: CatalogCoin; sets: { id: string; name: string }[] }` and `UpgradeWant = WantCoin & { grade: CoinGrade | null; targetGrade: CoinGrade }`.
- [x] 2.2 `GET /sets/wants` (auth required, no `@Public()`), declared with `summary` **before** the `:id` routes. In `SetsService.getWantList(userId)`, with two or three queries, not one per set:
  - every `UserSetCoin` of the caller's sets, with the coin through `CATALOG_COIN_SELECT` and the set's `id`, `name` and `minGrade`;
  - the caller's `Ownership` rows for those coins (`coinId`, `grade`).
  - **missing:** coins with no ownership row, one entry per coin, `sets` listing every caller set that contains it.
  - **upgrades:** owned coins that fail `meetsMinGrade` for at least one containing set; `targetGrade` is the highest `minGrade` among the sets it fails; `sets` lists those sets only.
  - A coin is never in both lists.
  - **Order:** country A–Z, then denomination with `localeCompare(…, { numeric: true })`, then year, then mint mark, then variety. `sets` ordered by name.
- [x] 2.3 Tests. Unit (`want-list.spec.ts`): dedupe across two sets; target grade is the highest failed minimum; an ungraded owned coin counts as an upgrade only where a minimum exists; ordering; empty account. E2E (`want-list.e2e-spec.ts`): 401 without a token; caller isolation against a second user; `missing.length` equals `uniqueMissingCount` from `GET /sets/summary`; `/sets/:id` routes still resolve (no route shadowing); the response coin has no `submittedByUserId`.
- [x] 2.4 ADR `docs/adr/2026-11-18-combined-want-list-computed-on-the-server.md`: why one endpoint (no N× `/gaps`), the dedupe and target-grade rules, and that the per-set list stays client-side.
- [x] 2.5 `docs/system-design_v2.md`: add the endpoint to the API contracts.

**Checkpoint:** one request returns every coin the caller wants across all sets, deduplicated, with upgrade targets.

## Phase 3: Combined want list page (5.3, web)

Ship after Phase 2 is live on Render, so the page never calls a missing endpoint.

- [x] 3.1 `lib/user-sets-api.ts` `getWantList()` and a `useWantList()` hook with the query key `['user-sets', 'wants']`, so the existing ownership and grade invalidations of `['user-sets']` refresh it. Check `ownership-cache.ts`: optimistic patching must skip this key (like the canonical gaps query), and a refetch after settle is enough.
- [x] 3.2 New route `app/want-list/page.tsx` (`RequireAuth`), same layout and components as the per-set page:
  - `h1` "Want list"; subtitle "Across your {n} sets · {m} missing · {k} to upgrade" (counts in mono); Print and Download CSV.
  - Missing and Upgrade wanted sections built with `buildWantGroups` and `WantListTable`; group headings always shown here (sets can mix series).
  - Under each section, a small "Which sets?" disclosure (a native `details` element, closed by default and not printed) listing each coin's sets as links, so the printed list stays compact.
  - **States:** loading (skeleton plus the shared `ServerWakingNotice`), error with Retry, no sets (link to `/sets/new`), nothing wanted ("Nothing missing across your sets.").
- [x] 3.3 CSV `buildWantListCsv(response)`: the per-set header plus a final `Sets` column (set names joined with "; "); filename `want-list-YYYY-MM-DD.csv` via `formatLocalDate`.
- [x] 3.4 Links: the dashboard tile "See what to look for" goes to `/want-list` and shows whenever `uniqueMissingCount > 0` (not only when there is a closest set); the per-set missing page gets a quiet link "Want list for all your sets". No nav or tab-bar change.
- [x] 3.5 i18n: a new `want-list` area (`locales/en/want-list.ts`, `locales/es/want-list.ts`) with the `wantList.` prefix added to `AREA_PREFIXES`.
- [x] 3.6 Tests: the page (grouping across two sets, the disclosure, every state, CSV), the dashboard tile link (update `my-sets-summary` tests), the hook's query key.
- [ ] 3.7 **Pending manual pass:** on the live site with a throwaway account, two sets sharing coins, one with a minimum grade. The combined list dedupes and shows the upgrade; Print and CSV work on a phone and a desktop; delete the account afterwards.

**Checkpoint:** a collector opens one page, or one printout, with every coin they still need and every coin they want in a better grade, across all their sets.

## Docs, per phase

- [x] Tick the matching growth items in `backlog_growth.md` (5.1 and 5.2 after Phase 1, 5.3 after Phase 3) with a one-line "Done 2026-…" note.
  - [x] Phase 1: 5.1 and 5.2 ticked, done 2026-11-19.
  - [x] Phase 3: 5.3 ticked, done 2026-11-20.
- [x] One `docs/history.md` entry per phase, in the style of the existing entries.
  - [x] Phase 1 entry, 2026-11-19.
  - [x] Phase 2 entry, 2026-11-20.
  - [x] Phase 3 entry, 2026-11-20.
- [x] `CLAUDE.md` "Built": add the want list in one line after Phase 3.

## Out of scope

Offline access and installing to a phone (5.4–5.6); sharing a want list publicly; per-coin notes or quantities; prices; changing how completion is counted.
