# Architecture Decision Records

Architecture Decision Records for Coin Collector Companion: one file per decision, named `YYYY-MM-DD-slug.md` after the date it was made.

The nine ADRs below were **backfilled on 2026-10-11** from the AI Orchestrator's run records for runs whose plans never reached `docs/runs/` (which stops at `run_20260804_165504`). Each was checked against the code on `main` at `e5334ca`.

Several of them **supersede positions in [`docs/system-design_v2.md`](../system-design_v2.md)**, which predates them and has not been updated:

| System design says | Now | ADR |
|---|---|---|
| No rate limiting anywhere (§5, §7) | Per-client-IP limits behind Render, with an explicit proxy hop count | [2026-10-01](2026-10-01-rate-limiting-per-client-ip-behind-render.md) |
| JWT check is signature-only (§4.2) | Every authenticated request checks that the user still exists | [2026-10-01](2026-10-01-jwt-validation-checks-the-user-exists.md) |
| Review is a manual database edit, no admin role (§4.7, §6) | In-app admin role, checked from the database per request | [2026-10-02](2026-10-02-in-app-admin-role.md), [2026-10-02](2026-10-02-submission-review-rules.md) |

| Date | Decision | Status |
|---|---|---|
| [2026-07-26](2026-07-26-dependency-free-i18n.md) | The web app uses a dependency-free i18n layer with compile-time key parity | Accepted; the locale-choice clause (first render always `en`) is superseded by [2026-11-16-locale-cookie-read-in-root-layout](2026-11-16-locale-cookie-read-in-root-layout.md) |
| [2026-10-01](2026-10-01-account-deletion-is-a-hard-delete.md) | Account deletion is an immediate hard delete in one transaction; submitted coins stay, anonymised | Accepted |
| [2026-10-01](2026-10-01-jwt-validation-checks-the-user-exists.md) | Every authenticated request checks that the user still exists | Accepted |
| [2026-10-01](2026-10-01-missing-list-built-in-the-browser.md) | The missing-coins CSV and print view are built in the browser from the gap data | Superseded by [2026-11-19-missing-csv-in-want-list-order-with-upgrade-rows](2026-11-19-missing-csv-in-want-list-order-with-upgrade-rows.md) |
| [2026-10-01](2026-10-01-rate-limiting-per-client-ip-behind-render.md) | Rate limits are per client IP, using an explicit proxy hop count | Accepted |
| [2026-10-02](2026-10-02-in-app-admin-role.md) | Catalog submissions are reviewed in-app by an admin role that is read from the database | Accepted |
| [2026-10-02](2026-10-02-submission-review-rules.md) | Review decisions are final, rejection reasons are visible only to the submitter, and duplicate warnings are advisory | Accepted |
| [2026-10-05](2026-10-05-collection-import-preview-then-confirm.md) | Collection import is a stateless preview-then-confirm flow that only adds ownership | Superseded by [2026-11-04-csv-import-confirm-sets-grades](2026-11-04-csv-import-confirm-sets-grades.md) |
| [2026-10-09](2026-10-09-album-view-client-side-projection.md) | The set Album view is a client-side projection of the gap data, with the view mode kept in the URL | Superseded by 2026-10-17 |
| [2026-10-13](2026-10-13-new-set-created-in-one-request.md) | Creating a set is one request; coins are picked afterwards in the set editor | Accepted |
| [2026-10-13](2026-10-13-set-list-endpoints-return-flat-coin-count.md) | Set list endpoints return a flat coinCount from Prisma _count | Accepted |
| [2026-10-16](2026-10-16-security-floors-enforced-by-lockfile-test.md) | Security version floors are enforced by a unit test that parses pnpm-lock.yaml | Accepted |
| [2026-10-17](2026-10-17-coin-name-from-one-shared-function.md) | Coin names are built by one shared function, `getCoinName`, returning eyebrow, title and subtitle | Accepted |
| [2026-10-17](2026-10-17-optimistic-ownership-toggle.md) | Ownership toggles are optimistic through the existing `useSetOwnership` mutation, with snapshot rollback | Accepted |
| [2026-10-17](2026-10-17-bulk-ownership-endpoint.md) | Bulk ownership changes go through one idempotent `PATCH /collection` request and a hook that shares the single-coin cache patching | Accepted |
| [2026-10-17](2026-10-17-set-page-album-default-year-groups.md) | The set page defaults to Album and shows both views as year groups, replacing the country/mint-mark album pages | Accepted |
| [2026-10-18](2026-10-18-user-set-list-returns-progress-per-set.md) | GET /sets returns a new UserSetListItem with ownedCount, totalCount and firstMissing, and UserSetSummary stays unchanged | Accepted |
| [2026-10-18](2026-10-18-sets-summary-endpoint-computes-suggestion-server-side.md) | GET /sets/summary returns the unique missing count, collection size and suggested checklist in one server-computed response | Accepted |
| [2026-10-18](2026-10-18-add-coins-sheet-membership-and-count-on-client.md) | The Add coins sheet derives set membership, ownership, hiding and the results count on the client, with no API change | Accepted |
| [2026-10-19](2026-10-19-collection-filtered-and-grouped-on-client.md) | The Collection page filters, counts and groups one unfiltered GET /collection on the client | Accepted |
| [2026-10-19](2026-10-19-removed-coins-stay-visible-via-page-local-list.md) | An un-owned coin stays on the Collection page as "Removed" through a page-local, display-only list | Accepted |
| [2026-10-19](2026-10-19-catalog-badges-from-two-batched-queries.md) | GET /catalog adds `owned` and `inSetsCount` for signed-in callers with two batched queries keyed by the page's coin ids | Accepted |
| [2026-11-02](2026-11-02-one-optional-adjectival-grade-per-ownership-row.md) | A coin's condition is one optional adjectival grade on the ownership row, with an optional per-set minimum grade | Superseded by [2026-11-04-csv-import-confirm-sets-grades](2026-11-04-csv-import-confirm-sets-grades.md) |
| [2026-11-02](2026-11-02-grade-gap-fields-conditional-on-min-grade.md) | In the gap view, grade and minGrade are always present and nullable, while needsUpgrade and upgradeCount appear only when the set has a minGrade | Accepted |
| [2026-11-03](2026-11-03-grade-saves-use-separate-optimistic-hook.md) | Grade edits go through a separate `useSetGrade` hook that shares the cache helpers of `useSetOwnership` | Accepted |
| [2026-11-03](2026-11-03-min-grade-save-waits-for-gap-view-refetch.md) | Saving a set's minimum grade is not optimistic: the mutation stays pending until the gap view is refetched | Accepted |
| [2026-11-04](2026-11-04-csv-import-confirm-sets-grades.md) | CSV import confirm takes an optional grades array and overwrites grades, never clearing one | Accepted |
| [2026-11-06](2026-11-06-node-major-pinned-to-26-on-every-platform.md) | Node is pinned to major 26 on every platform: Render, CI, `engines` and `.nvmrc` | Accepted |
| [2026-11-07](2026-11-07-pnpm-overrides-for-multer-and-deepmerge-ts.md) | Two pnpm overrides lift multer to 2.5.0 and deepmerge-ts to 8.x, because their parents pin the vulnerable versions exactly | Accepted; both overrides removed: multer 2026-11-07 (Phase 6), deepmerge-ts 2026-11-08 (Phase 7) |
| [2026-11-08](2026-11-08-prisma-7-with-the-pg-driver-adapter.md) | Prisma 7 runs through the `@prisma/adapter-pg` driver adapter, with a CommonJS client generated into `apps/api/src/generated/prisma` and `prisma.config.ts` for the CLI | Accepted |
| [2026-11-08](2026-11-08-canonical-checklist-gaps-separate-endpoint.md) | Curated checklists get their own auth-only `GET /sets/canonical/:id/gaps` that reuses `GapViewResponse`, with `minGrade` always null | Accepted |
| [2026-11-09](2026-11-09-public-set-progress-reuses-owner-gaps-endpoint.md) | The public set page takes the viewer's progress from `GET /sets/:id/gaps` and ignores the owner's grade fields | Accepted |
| [2026-11-09](2026-11-09-canonical-gaps-query-under-user-sets-key.md) | The curated checklist gaps query is keyed `['user-sets', 'canonical', id, 'gaps']` | Accepted |
| [2026-11-10](2026-11-10-i18n-dictionaries-split-by-area.md) | The en and es dictionaries are split into ten per-area files per locale, with each es area typed against its en area | Accepted |
| [2026-11-10](2026-11-10-set-page-sections-are-prop-only-components.md) | Page splits move JSX into prop-only section components while the route file keeps all state, effects, data hooks and handlers | Accepted |
| [2026-11-10](2026-11-10-add-coins-focus-trap-effect-wrapped-in-a-hook.md) | The Add coins sheet's Escape and Tab keydown effect lives in a hook the sheet calls, as a narrow exception to prop-only components | Accepted |
| [2026-11-11](2026-11-11-collection-export-built-in-the-browser-round-trip-safe.md) | Collection export built in the browser, round-trip safe with the import | Accepted |
| [2026-11-15](2026-11-15-api-security-headers-helmet-defaults-no-csp-relaxation.md) | The API sends helmet's default security headers unchanged, with no CSP relaxation, including on Swagger UI | Accepted |
| [2026-11-15](2026-11-15-render-build-applies-migrations.md) | Every Render deploy applies pending migrations with `prisma migrate deploy` inside `buildCommand` | Accepted |
| [2026-11-16](2026-11-16-locale-cookie-read-in-root-layout.md) | The root layout reads the visitor's locale from a `ccc-locale` cookie, so `<html lang>` and the first render match it, and every route renders dynamically | Accepted |
| [2026-11-18](2026-11-18-combined-want-list-computed-on-the-server.md) | The combined want list is computed on the server by one GET /sets/wants in three queries, deduplicated per coin, while the per-set list stays in the browser | Accepted |
| [2026-11-19](2026-11-19-missing-csv-in-want-list-order-with-upgrade-rows.md) | The missing-coins CSV is in want-list order, appends upgrade rows, and gains Want, Grade and Target grade columns | Accepted |
| [2026-11-19](2026-11-19-one-want-list-table-component-for-every-want-list.md) | One presentational WantListTable renders every want list, grouped by country and denomination, then year | Accepted |
| [2026-11-20](2026-11-20-want-list-query-refetched-not-patched.md) | The combined want list query is keyed `['user-sets', 'wants']` and is refetched, never optimistically patched | Accepted |
| [2026-11-20](2026-11-20-want-list-csv-adds-sets-column.md) | The want-list CSV is the per-set CSV's eleven columns plus a final `Sets` column, in server order | Accepted |
| [2026-11-20](2026-11-20-posthog-cookieless-analytics.md) | Product analytics is PostHog Cloud in cookieless mode, never identifying users, behind a same-origin /relay proxy | Accepted |
| [2026-11-21](2026-11-21-custom-domain-makes-web-and-api-same-site.md) | Web and API move under one registrable domain, so the SameSite=Lax refresh cookie is same-site and works unchanged | Accepted |
| [2026-11-21](2026-11-21-denominations-ordered-by-face-value-parsed-from-the-string.md) | Denominations sort by face value in the main unit, parsed from the string with a fixed word table | Accepted |
| [2026-11-21](2026-11-21-catalog-import-diffs-per-file-and-writes-one-transaction.md) | The catalog import diffs each fixture file against the database in memory and writes only the difference in one transaction | Accepted |
| [2026-11-21](2026-11-21-fixture-generator-reads-wikipedia-wikitext-tables.md) | The fixture generator parses the article's wikitext with a built-in table reader, not rendered HTML with a parser library | Accepted |
| [2026-11-21](2026-11-21-generated-varieties-only-where-rows-need-telling-apart.md) | Generated fixtures give a row a variety only where it is needed to tell rows apart, and leftover duplicate keys are flagged, never merged | Accepted |
| [2026-11-21](2026-11-21-unmarked-branch-mint-strikes-summed-into-one-coin.md) | Unmarked branch-mint business strikes are one no-mark coin per year, with the source figures summed and listed in the fixture | Accepted |
| [2026-11-21](2026-11-21-post-1989-design-check-gates-images-not-catalog-rows.md) | The per-design check for US designs from March 1989 onward gates images only; catalog rows for those designs are imported without it | Accepted |
| [2026-11-21](2026-11-21-canonical-template-changes-ship-as-a-new-version-file.md) | A changed canonical template ships as a new `.vN+1.json` file, and `seed:canonical` seeds only the newest version of each template | Accepted. [2026-11-26-mint-mark-is-what-is-struck-null-when-unmarked](2026-11-26-mint-mark-is-what-is-struck-null-when-unmarked.md) records an exception: a template never seeded in production is corrected in place in its v1 file |
| [2026-11-22](2026-11-22-commons-images-found-by-one-category-crawl.md) | Ukrainian coin images are found by crawling Category:Coins of Ukraine once and matching file names locally | Accepted |
| [2026-11-22](2026-11-22-image-url-is-the-commons-500px-thumbnail.md) | The stored image url is Commons' 500 px thumbnail, not the original file | Accepted |
| [2026-11-22](2026-11-22-commons-image-match-is-strict-and-lists-the-rest.md) | A Commons file is written to a fixture only on a strict match; everything else is listed for a human | Accepted |
| [2026-11-22](2026-11-22-commons-requests-paced-and-retried-with-a-cap.md) | Commons requests are paced at 1 s and retried on 429, 5xx and network failures, with at most 4 attempts and 60 s per wait | Accepted |
| [2026-11-23](2026-11-23-empty-catalog-searches-sent-to-posthog-with-search-text.md) | Empty catalog searches are sent to PostHog as `catalog_no_results`, with the filters and a 40-character search text | Accepted |
| [2026-11-23](2026-11-23-no-results-event-fires-once-per-sent-properties-per-page-mount.md) | The `catalog_no_results` event fires once per distinct set of sent properties per page mount, never from placeholder data | Accepted |
| [2026-11-24](2026-11-24-unmarked-philadelphia-dollars-get-mint-mark-p.md) | Philadelphia coins struck without a mint mark get `mintMark` "P" in the dollar fixtures, so `mintMark` is never null | Superseded by [2026-11-26-mint-mark-is-what-is-struck-null-when-unmarked](2026-11-26-mint-mark-is-what-is-struck-null-when-unmarked.md) |
| [2026-11-25](2026-11-25-unmarked-nickels-dimes-quarters-get-null-mint-mark.md) | Unmarked nickels, dimes and 1932-1998 quarters get `mintMark` null, while the dollars keep "P" | Superseded by [2026-11-26-mint-mark-is-what-is-struck-null-when-unmarked](2026-11-26-mint-mark-is-what-is-struck-null-when-unmarked.md) (its provisional silver-dime exception; the null rule it set is restated there for every US series) |
| [2026-11-25](2026-11-25-key-dates-recorded-in-fixture-keydates-block.md) | Key dates are flagged only where a saved source names them, and recorded in a `keyDates` block in the fixture | Accepted |
| [2026-11-25](2026-11-25-morgan-and-peace-dollars-unmarked-philadelphia-null.md) | Unmarked Philadelphia Morgan and Peace dollars get `mintMark` null, although the modern dollar files use "P" | Accepted |
| [2026-11-25](2026-11-25-1921-philadelphia-dollars-told-apart-by-series-variety.md) | The 1921 Philadelphia Morgan and Peace dollars are told apart by the varieties "Morgan" and "Peace" | Accepted |
| [2026-11-26](2026-11-26-mint-mark-is-what-is-struck-null-when-unmarked.md) | `mintMark` is what is struck on the coin, `null` when the coin carries no mark, in every US series | Accepted |

## Where else decisions live

- [`docs/system-design_v2.md`](../system-design_v2.md): the v2 architecture and its trade-off table (§6). This is the baseline the ADRs above amend.
- `docs/runs/<run id>/plan.md`: technical plans for the July and early August orchestrator runs.
- `docs/design/`: visual design briefs (album view, catalog sidebar). The catalog sidebar's API changes (multi-value `denomination`, `keyDateOnly`, `hideOwned`, `sort`, `GET /catalog/facets`) are specified there.
- `CLAUDE.md` and `.claude/rules/*.md`: current architecture summary and easy-to-break rules.

Not written up as ADRs, because they are covered elsewhere or are purely presentational: catalog contributions (`run_20260725_140648`, system design §4.7), variety and link in set coin lists (`run_20261006_215558`), album card redesign (`run_20261010_083926`), and the album and catalog redesigns (`run_20261011_095624` and `run_20261011_105146`, `docs/design/`).

## Adding a new ADR

The orchestrator writes ADRs for its runs (stage 6d, `orch-adr-writer`). To add one by hand,
copy an existing file. Name it `YYYY-MM-DD-short-slug.md` (the date the decision was made,
lowercase kebab-case slug) and add a row to the table above.

```markdown
# <the decision, stated as a sentence>

- **Status:** Accepted | Superseded by [YYYY-MM-DD-slug](YYYY-MM-DD-slug.md)
- **Date:** YYYY-MM-DD
- **Source:** <run id, PR or discussion>
- **Code:** <main files>

## Context
## Decision
## Alternatives considered
## Consequences
```

Don't edit an accepted ADR's decision. Write a new ADR that supersedes it, and change only
the old one's Status line.
