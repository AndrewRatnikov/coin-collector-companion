# Collection export built in the browser, round-trip safe with the import

- **Status:** Accepted
- **Date:** 2026-11-11
- **Source:** orchestrator run `run_20261111_062918` (Collection Export CSV, phase 1; the fixed decisions come from the user's task text)
- **Code:** `packages/shared/src/index.ts`, `apps/web/src/lib/missing-list.ts`, `apps/api/src/collection/collection.service.ts`, `apps/api/src/collection-import/collection-csv-roundtrip.spec.ts`

## Context

The user wants a backup of their collection as a CSV that the existing CSV import can read back with no manual column mapping. `GET /collection` already returns everything needed, and the web app loads it. The missing-list CSV ([2026-10-01-missing-list-built-in-the-browser](2026-10-01-missing-list-built-in-the-browser.md)) already has the cell rules (formula-injection prefix, RFC 4180 quoting, BOM, CRLF), but they lived privately in `apps/web/src/lib/missing-list.ts`.

This is phase 1 of the feature: the builder, the API fix and the tests. The web UI (the export button) lands in phase 2.

## Decision

- **The CSV is built in the browser**, by a pure `buildCollectionCsv(items)` in `packages/shared/src/index.ts`, from the full, unfiltered `GET /collection` data. There is no server export endpoint.
- **Fixed format**, the same in every UI language: header `COLLECTION_CSV_HEADER` = `Country,Denomination,Year,Mint mark,Variety,Grade,Series,Key date,Mintage,Owned since`; grade as the neutral stored code (empty when ungraded); `yes`/`no` for key date; local `YYYY-MM-DD` for the date; Series is `coin.name`.
- **Sorted** on a copy of the input by country, denomination (`compareDenominations`, numeric), year, mint mark, variety. String comparisons are code-unit, not `localeCompare`, so output does not depend on the runtime's locale.
- **Shared cell rules.** `CSV_BOM`, `csvCell`, `csvRow`, `csvDocument` and `formatLocalDate` moved from `missing-list.ts` into `packages/shared`; the missing list uses them and its output is byte-identical (pinned by a golden test). All of it stays in `index.ts`: a separate `csv.ts` would need a `.js` relative import that the api Jest mapping cannot resolve.
- **Round-trip is tested** by `collection-csv-roundtrip.spec.ts`, which runs the output through the real `parseCsv`, `suggestMapping` and `matchRows` and expects every row to match its own coin and grade, with no grade warnings, over an inline catalog and the whole fixture catalog.
- **`GET /collection` now selects `CATALOG_COIN_SELECT`** for the embedded coin, so `submittedByUserId` is no longer returned to the client (the data feeding the export), as the gap view already did.

## Alternatives considered

- A server export endpoint: the data is already on the client, as in the missing-list ADR.
- Exporting only the filtered view: a backup must be complete.
- A `Name` column for `coin.name`: `suggestMapping` maps `name`, `coin`, `title`, `description` and `item` to `combined`, which changes how the import reads year and mint mark. The column is called `Series`.
- Localized headers: the file must be identical in every language and match the import's English synonyms.
- `localeCompare` sorting: results depend on the runtime's ICU and locale.
- Keeping `include: { coin: true }` and stripping fields in JS: easy to forget a field, and not the repo's pattern.

## Consequences

- Export and import are coupled by the header names and cell formats. A change to `suggestMapping` synonyms or the matcher can break the round trip; the roundtrip spec catches it.
- The full-catalog round-trip test could fail if a future catalog addition creates varieties whose tokens are a subset of another's (the matcher would report `multiple_matches`). That is a matcher issue, not an export one.
- Years below 1000 would fail the import's four-digit year check; the catalog has none.
- A leading `=+-@` in an identity field gets a `'` prefix; the matcher strips `'`, so it still matches.
- `OwnershipItem.ownedAt` is typed `Date` but arrives as an ISO string; `CollectionCsvItem.ownedAt` accepts both.
- `packages/shared` has no test runner, so its tests live in `apps/web/src/lib/` and read the built `dist/`.
- No UI uses the builder until phase 2.
