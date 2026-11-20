# The want-list CSV is the per-set CSV's eleven columns plus a final `Sets` column, in server order

- **Status:** Accepted
- **Date:** 2026-11-20
- **Source:** orchestrator run `run_20261120_215525` (want list Phase 3, growth 5.3, web; `docs/backlog_want-list.md` item 3.3)
- **Code:** `apps/web/src/lib/missing-list.ts`

## Context

The `/want-list` page needs Download CSV. [2026-11-19-missing-csv-in-want-list-order-with-upgrade-rows](2026-11-19-missing-csv-in-want-list-order-with-upgrade-rows.md) fixed the per-set CSV's layout, which users keep in spreadsheets. A combined list also has to say which sets want each coin.

## Decision

`buildWantListCsv(response)` in `missing-list.ts` writes `WANT_LIST_CSV_HEADER`, which is `MISSING_CSV_HEADER` plus `,Sets`. Rows are the `missing` entries, then the `upgrades` entries, each in the order `GET /sets/wants` returned them; nothing is re-sorted. The first eleven cells come from the same `coinCells` and `csvRow` as the per-set file (so escaping and formula protection are shared). The last cell is the set names as stored, joined with `"; "`. The file name is `want-list-YYYY-MM-DD.csv` (`wantListCsvFilename`), and `downloadWantListCsv` uses the same Blob and deferred-revoke approach as `downloadMissingCsv`. The per-set functions are unchanged.

## Alternatives considered

- One row per (coin, set): repeats coins the list deliberately dedupes.
- Re-sorting on the client: the server order is already the grouping order the page shows, so a second sort could drift from it.
- A separate module: would duplicate `coinCells` and the CSV escaping.

## Consequences

A spreadsheet built from the per-set file lines up with the combined one for the first eleven columns, and the file reads in the page's order. A set name containing `; ` is ambiguous in the Sets cell. The CSV row order depends on the server's sort; if that stops grouping by country and denomination, the file and page order would diverge (the page still groups correctly).
