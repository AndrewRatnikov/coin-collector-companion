# The missing-coins CSV is in want-list order, appends upgrade rows, and gains Want, Grade and Target grade columns

- **Status:** Accepted
- **Date:** 2026-11-19
- **Source:** orchestrator run `run_20261119_210926` (want list Phase 1, growth 5.1 and 5.2; `docs/backlog_want-list.md` item 1.6)
- **Code:** `apps/web/src/lib/missing-list.ts`, `apps/web/src/lib/csv.test.ts`
- **Supersedes:** [2026-10-01-missing-list-built-in-the-browser](2026-10-01-missing-list-built-in-the-browser.md) (only its CSV row order and missing-only content)

## Context

[2026-10-01-missing-list-built-in-the-browser](2026-10-01-missing-list-built-in-the-browser.md) built the CSV from missing slots sorted by `position`. The want list page now groups by (country, denomination), then year, and also shows owned coins below the set's minimum grade ("Upgrade wanted"). A CSV in position order, without upgrades, would not match what the page prints. Users keep these files in spreadsheets, so the column layout is an external contract.

## Decision

- The browser-built, no-API-change approach, the RFC 4180 quoting, BOM, CRLF, formula protection and fixed English headers from the earlier ADR all stay.
- `MISSING_CSV_HEADER` is now `Name,Country,Denomination,Year,Mint mark,Variety,Key date,Mintage,Want,Grade,Target grade`. The first eight columns are unchanged; three are appended.
- `buildMissingCsv` writes the missing slots first, then the upgrade slots (`getUpgradeSlots`: owned and `needsUpgrade`). Each list goes through `orderByWantList`: groups by first appearance, years by first appearance within a group, position order inside a year. This is the order `buildWantGroups` gives the page.
- Missing rows end `missing,,`. Upgrade rows end `upgrade,{owned grade or empty},{set minGrade or empty}`. Grade cells are the codes (`G` to `UNC`), never localized.
- `buildMissingCsv` and `downloadMissingCsv` take `MissingCsvGaps` (`slots` plus optional `minGrade`), so callers that pass only `{ slots }` still compile. The page and the set page menu both call the same function.

## Alternatives considered

- **A separate upgrade CSV.** Rejected: two files for one list, while the page shows one.
- **Keep position order.** Rejected: the CSV would not match the page and the print.
- **Localized grade labels in the CSV.** Rejected: CSV headers and values are fixed English, so the file is the same in every UI language.

## Consequences

- Existing spreadsheets and imports keyed on the first eight columns keep lining up; anything that assumed exactly eight columns or position order will see a change.
- Sets without a minimum grade produce only `missing` rows.
- A future change to the column set or order is another contract change and needs a new ADR.
